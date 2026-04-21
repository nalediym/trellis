/**
 * Skill runtime — the one dispatcher every skill invocation goes through.
 *
 * Wraps policy + DLP + audit around five kind-specific runners:
 *
 *   parent-comms-attendance  -> streamParentComms (flagship, keeps the
 *                                parent-comms-attendance existing behavior)
 *   lesson-plan-qa           -> runLessonPlanQa (RAG over handbook)
 *   policy-handbook-summary  -> runPolicySummary (one-shot summary)
 *   parent-contact-translate -> runParentTranslate (one-shot translation)
 *   ops-ticket-triage        -> runTicketTriage (structured classifier)
 *
 * Each skill gracefully degrades when GOOGLE_GENERATIVE_AI_API_KEY is
 * missing — returns a deterministic stub with a "stub mode" marker so a
 * visitor without a key still sees every surface.
 *
 * Output protocol: newline-delimited JSON events on a ReadableStream so
 * every skill shape (streaming / one-shot / structured) uses the same
 * wire format. Stages:
 *
 *   {stage: "policy",      payload: PolicyDecision}
 *   {stage: "retrieval",   payload: SourceChunk[]}
 *   {stage: "dlp_input",   payload: DlpScanResult}       (pre-model)
 *   {stage: "draft_delta", payload: "<partial text>"}    (streaming)
 *   {stage: "structured",  payload: object}              (one-shot/classifier)
 *   {stage: "dlp_output",  payload: DlpScanResult}       (post-model)
 *   {stage: "done",        payload: {outcome, modelUsed, ...}}
 *   {stage: "error",       payload: {message}}
 */
import { streamText, generateText, type LanguageModel } from "ai";

import {
  getSkill,
  getRegistry,
} from "./manifests";
import { canInvoke } from "./policy";
import { scanOutput, summarizeFindings } from "./dlp";
import { logInvocation, type AuditFindingSummary } from "./audit";
import {
  handbookConnector,
  type HandbookSource,
} from "./connectors/handbook";
import { draftMessage, markGmailUsed } from "./connectors/gmail";
import { markSisUsed } from "./connectors/sis";
import type { Skill } from "./schemas";

export interface SkillRunContext {
  skillId: string;
  personaId: string;
  inputs: Record<string, unknown>;
}

export function hasApiKey(): boolean {
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
}

interface EmitFn {
  (ev: unknown): void;
}

/**
 * Top-level dispatcher. Returns a ReadableStream of NDJSON events.
 */
export function runSkillStream({
  skillId,
  personaId,
  inputs,
}: SkillRunContext): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const start = Date.now();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit: EmitFn = (ev) => {
        controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
      };

      const collectedDlp: AuditFindingSummary[] = [];
      let outcome: "allowed" | "denied" | "error" | "blocked" = "allowed";
      let reason = "allowed";

      try {
        const skill = getSkill(skillId);
        if (!skill) {
          emit({
            stage: "error",
            payload: { message: `unknown skill "${skillId}"` },
          });
          outcome = "error";
          reason = "unknown skill";
          controller.close();
          return;
        }

        // --- policy check --------------------------------------------
        const decision = canInvoke({ personaId, skillId });
        emit({ stage: "policy", payload: decision });
        if (!decision.allowed) {
          outcome = "denied";
          reason = decision.reason;
          emit({
            stage: "done",
            payload: {
              outcome,
              reason,
              modelUsed: "none",
              stubMode: !hasApiKey(),
            },
          });
          controller.close();
          return;
        }

        // --- input-side DLP ------------------------------------------
        const inputText = JSON.stringify(inputs ?? {});
        const inputScan = scanOutput({
          output: inputText,
          dlpRuleIds: skill.dlp_rules ?? [],
          inputs,
        });
        for (const f of inputScan.findings) {
          if (f.severity === "info") continue;
          collectedDlp.push({
            rule_id: f.rule_id,
            severity: f.severity,
            label: f.label,
          });
        }
        emit({ stage: "dlp_input", payload: inputScan });

        if (inputScan.blocked) {
          outcome = "blocked";
          reason = "input DLP block";
          emit({
            stage: "done",
            payload: {
              outcome,
              reason: "blocked by input DLP scan",
              modelUsed: "none",
              stubMode: !hasApiKey(),
            },
          });
          controller.close();
          return;
        }

        // --- kind-specific runtime dispatch --------------------------
        let modelUsed = "none";
        let rawOutputForDlp = "";
        let structuredOutput: Record<string, unknown> | undefined;

        if (skill.id === "parent-comms-attendance") {
          const result = await runParentComms(skill, inputs, emit);
          modelUsed = result.modelUsed;
          rawOutputForDlp = result.text;
        } else if (skill.id === "lesson-plan-qa") {
          const result = await runLessonPlanQa(skill, inputs, emit);
          modelUsed = result.modelUsed;
          rawOutputForDlp = result.text;
        } else if (skill.id === "policy-handbook-summary") {
          const result = await runPolicySummary(skill, inputs, emit);
          modelUsed = result.modelUsed;
          rawOutputForDlp = result.text;
        } else if (skill.id === "parent-contact-translate") {
          const result = await runParentTranslate(skill, inputs, emit);
          modelUsed = result.modelUsed;
          rawOutputForDlp = result.text;
          structuredOutput = result.structuredOutput;
        } else if (skill.id === "ops-ticket-triage") {
          const result = await runTicketTriage(skill, inputs, emit);
          modelUsed = result.modelUsed;
          structuredOutput = result.structuredOutput;
          rawOutputForDlp = JSON.stringify(structuredOutput ?? {});
        } else {
          emit({
            stage: "error",
            payload: { message: `no runtime for skill "${skill.id}"` },
          });
          outcome = "error";
          reason = "no runtime";
        }

        // --- output-side DLP -----------------------------------------
        if (outcome === "allowed") {
          const outputScan = scanOutput({
            output: rawOutputForDlp,
            dlpRuleIds: skill.dlp_rules ?? [],
            structuredOutput,
            inputs,
          });
          for (const f of outputScan.findings) {
            if (f.severity === "info") continue;
            collectedDlp.push({
              rule_id: f.rule_id,
              severity: f.severity,
              label: f.label,
            });
          }
          emit({ stage: "dlp_output", payload: outputScan });

          if (outputScan.blocked) {
            outcome = "blocked";
            reason = "output DLP block";
          }
        }

        emit({
          stage: "done",
          payload: {
            outcome,
            reason,
            modelUsed,
            stubMode: !hasApiKey() && modelUsed.includes("stub"),
            dlpSummary: summarizeFindings(
              collectedDlp.map((f) => ({
                rule_id: f.rule_id,
                rule_kind: "classification",
                severity: f.severity,
                label: f.label,
              })),
            ),
          },
        });
        controller.close();
      } catch (err) {
        emit({
          stage: "error",
          payload: {
            message: err instanceof Error ? err.message : "unknown runtime error",
          },
        });
        outcome = "error";
        reason = err instanceof Error ? err.message : "unknown";
        controller.close();
      } finally {
        logInvocation({
          personaId,
          skillId,
          inputs,
          dlpFindings: collectedDlp,
          outcome,
          reason,
          durationMs: Date.now() - start,
        });
      }
    },
  });
}

// --- skill runners --------------------------------------------------------

const STUB_MARK = "stub (set GOOGLE_GENERATIVE_AI_API_KEY for live drafts)";

interface RunnerResult {
  modelUsed: string;
  text: string;
  structuredOutput?: Record<string, unknown>;
}

// ---- parent-comms-attendance (streaming flagship) -----------------------

async function runParentComms(
  skill: Skill,
  inputs: Record<string, unknown>,
  emit: EmitFn,
): Promise<RunnerResult> {
  const first = String(inputs.student_first_name ?? "your student");
  const preferred = String(inputs.guardian_preferred_name ?? "there");
  const lang = String(inputs.guardian_preferred_language ?? "en");
  const n = Number(inputs.attendance_absences_14d ?? 0);
  const homeroom = String(inputs.homeroom ?? "homeroom");

  // Retrieval via handbook connector
  const query = `attendance escalation parent communication ${n} absences ${homeroom}`;
  const sources = handbookConnector.retrieve(query, 3);
  emit({
    stage: "retrieval",
    payload: sources.map((s) => ({
      path: s.path,
      heading: s.heading,
      score: s.score,
    })),
  });

  const contextText = sources
    .map((s) => `[${s.path}#${s.heading}]\n${s.text}`)
    .join("\n\n");

  const system = [
    "You are drafting a parent-attendance check-in on behalf of a teacher.",
    "Follow the Parent Communication Guidelines from the handbook.",
    "You will be given: the student's first name only, the guardian's preferred name and language, the unexplained-absence count in the last 14 days, and the homeroom.",
    "Produce a 3-to-5-sentence draft in the guardian's preferred language.",
    "Structure: greet, name the observation (N unexplained absences in the last 14 days), offer a next step with a concrete 48-hour check-in call timeline, close by offering to talk.",
    "Never include other students, disciplinary history, 'your child', 'non-compliant', 'legal', 'required', 'violation', or 'compliance'.",
    "Sign off with {{teacher.name}} as a placeholder.",
    "",
    "# Handbook excerpts you may use",
    "",
    contextText || "(no excerpts retrieved)",
  ].join("\n");

  const user = JSON.stringify(
    { student_first_name: first, guardian_preferred_name: preferred, guardian_preferred_language: lang, attendance_absences_14d: n, homeroom },
    null,
    2,
  );

  let fullText = "";

  if (hasApiKey() && skill.models?.draft) {
    try {
      const modelId = skill.models.draft;
      const result = streamText({
        model: modelId as unknown as LanguageModel,
        system,
        prompt: user,
        maxOutputTokens: 600,
      });
      for await (const delta of result.textStream) {
        fullText += delta;
        emit({ stage: "draft_delta", payload: delta });
      }
      // Mark connector usage for the /connectors UI.
      markGmailUsed();
      return { modelUsed: modelId, text: fullText };
    } catch (err) {
      emit({
        stage: "error",
        payload: {
          message: `live model failed: ${
            err instanceof Error ? err.message : "unknown"
          }; falling back to stub`,
        },
      });
    }
  }

  // --- stub fallback ---
  const stubDraft = [
    `Hi ${preferred} — I wanted to reach out because I noticed ${first} has had ${n} unexplained absences in ${homeroom} over the last two weeks.`,
    `I'd love to check in so we can figure out together if there's something going on and what the best way forward looks like.`,
    `Is there a time in the next 48 hours that works for a quick call?`,
    `Thank you — {{teacher.name}}`,
  ].join(" ");
  await streamStub(stubDraft, emit);
  fullText = stubDraft;

  // Simulate a Gmail draft creation so the connector panel shows activity.
  draftMessage({
    to: `guardian-of-${first.toLowerCase()}@example.org`,
    subject: `Checking in about ${first}`,
    body: stubDraft,
  });
  markGmailUsed();
  markSisUsed();

  return { modelUsed: STUB_MARK, text: fullText };
}

// ---- lesson-plan-qa (RAG) -----------------------------------------------

async function runLessonPlanQa(
  skill: Skill,
  inputs: Record<string, unknown>,
  emit: EmitFn,
): Promise<RunnerResult> {
  const question = String(inputs.question ?? "");
  const grade = inputs.grade_level ? String(inputs.grade_level) : undefined;

  const sources = handbookConnector.retrieve(question, 3);
  emit({
    stage: "retrieval",
    payload: sources.map((s) => ({
      path: s.path,
      heading: s.heading,
      score: s.score,
    })),
  });
  const contextText = sources
    .map((s) => `[${s.path}#${s.heading}]\n${s.text}`)
    .join("\n\n");

  const system = [
    "You are a reference assistant for teachers asking lesson-plan or policy questions.",
    "Use ONLY the handbook excerpts provided. If the excerpts don't answer the question, say so in one sentence and suggest who to ask (dean for attendance, department head for subject-matter).",
    "Produce a two-sentence answer, then a Citations: line naming the handbook files you pulled from.",
    "Never identify specific students or teachers. Never invent policy.",
    "",
    "# Handbook excerpts",
    "",
    contextText || "(no excerpts retrieved)",
  ].join("\n");

  const user = grade
    ? `Grade: ${grade}\nQuestion: ${question}`
    : `Question: ${question}`;

  let fullText = "";

  if (hasApiKey() && skill.models?.draft) {
    try {
      const modelId = skill.models.draft;
      const result = streamText({
        model: modelId as unknown as LanguageModel,
        system,
        prompt: user,
        maxOutputTokens: 400,
      });
      for await (const delta of result.textStream) {
        fullText += delta;
        emit({ stage: "draft_delta", payload: delta });
      }
      return { modelUsed: modelId, text: fullText };
    } catch (err) {
      emit({
        stage: "error",
        payload: {
          message: `live model failed: ${
            err instanceof Error ? err.message : "unknown"
          }; falling back to stub`,
        },
      });
    }
  }

  const stubAnswer = stubQaAnswer(question, sources);
  await streamStub(stubAnswer, emit);
  return { modelUsed: STUB_MARK, text: stubAnswer };
}

function stubQaAnswer(question: string, sources: HandbookSource[]): string {
  if (sources.length === 0) {
    return (
      "I can't answer this from the handbook — no matching sections were retrieved. " +
      "Consider asking the dean for attendance policy questions or the department head for subject-matter questions.\n\n" +
      "Citations: (none)"
    );
  }
  const q = question.toLowerCase();
  let lead: string;
  if (q.includes("absence") || q.includes("escalation") || q.includes("unexplained")) {
    lead =
      "Two unexplained absences in a rolling 10-day window trigger a templated guardian check-in within 48 hours. " +
      "Three trigger a dean-of-students voice call; five in 20 days triggers a scheduled meeting.";
  } else if (q.includes("pii") || q.includes("ssn") || q.includes("medical")) {
    lead =
      "The handbook restricts SSNs, home addresses, IEP/504 status, health records, and counselor notes from AI-generated parent communication. " +
      "Only first names, grade/homeroom, 14-day attendance counts, and guardian preferences may appear in outgoing messages.";
  } else if (q.includes("language") || q.includes("translat")) {
    lead =
      "AI-generated messages default to the guardian's preferred language. " +
      "Any non-English translation is human-reviewed by a speaker of the target language before send.";
  } else {
    lead =
      sources[0].text.split(/\.\s+/).slice(0, 2).join(". ") + ".";
  }
  const citations = sources.map((s) => `${s.path}#${s.heading}`).join(", ");
  return `${lead}\n\nCitations: ${citations}`;
}

// ---- policy-handbook-summary (one-shot summary) -------------------------

async function runPolicySummary(
  skill: Skill,
  inputs: Record<string, unknown>,
  emit: EmitFn,
): Promise<RunnerResult> {
  const section = String(inputs.section_id ?? "attendance");
  const audience = String(inputs.audience ?? "parents");
  const length = String(inputs.length ?? "short");

  const sectionText = handbookConnector.sectionText(section);
  emit({
    stage: "retrieval",
    payload: [
      {
        path: section,
        heading: `full section (${sectionText.length} chars)`,
        score: 1.0,
      },
    ],
  });

  const system = [
    `Summarize a handbook section for a ${audience} audience in ${length} length.`,
    "Never invent policy not in the source. Use plain, warm English (or the audience's voice).",
    "If length is one-sentence, output one sentence. short = 2 sentences. medium = 4-5 sentences.",
    "",
    "# Source section",
    "",
    sectionText || "(no content for this section)",
  ].join("\n");

  const user = `Audience: ${audience}\nLength: ${length}\nSection: ${section}`;

  if (hasApiKey() && skill.models?.draft) {
    try {
      const modelId = skill.models.draft;
      const { text } = await generateText({
        model: modelId as unknown as LanguageModel,
        system,
        prompt: user,
        maxOutputTokens: 400,
      });
      const out = text.trim();
      await streamStub(out, emit, /*chunkMs*/ 4);
      return { modelUsed: modelId, text: out };
    } catch (err) {
      emit({
        stage: "error",
        payload: {
          message: `live model failed: ${
            err instanceof Error ? err.message : "unknown"
          }; falling back to stub`,
        },
      });
    }
  }

  const stub = stubSectionSummary(section, audience, length);
  await streamStub(stub, emit);
  return { modelUsed: STUB_MARK, text: stub };
}

function stubSectionSummary(
  section: string,
  audience: string,
  length: string,
): string {
  const base: Record<string, string> = {
    attendance:
      "The school takes attendance in the first ten minutes of homeroom. Two unexplained absences in two weeks triggers a guardian check-in; three triggers a voice call; five in twenty days triggers a meeting. Guardians are always contacted in their preferred language.",
    "parent-communication":
      "Every message to a guardian is warm, specific, and forward-looking. Messages greet by preferred name, name one observation, propose a next step with a timeline, and offer to talk. Legal language, other students, and unsubstantiated claims never appear.",
    "pii-handling":
      "Student and guardian data is restricted. AI-drafted messages may use first names, grade/homeroom, and 14-day attendance counts. SSNs, addresses, IEP/504 status, health data, and counselor notes never appear.",
  };
  const core = base[section] ?? `Summary of the ${section} section.`;
  if (length === "one-sentence") return core.split(/\.\s+/)[0] + ".";
  if (length === "medium")
    return (
      core +
      ` This summary is tailored for a ${audience} audience — plain English, no jargon, warm tone.`
    );
  return core;
}

// ---- parent-contact-translate (one-shot) --------------------------------

async function runParentTranslate(
  skill: Skill,
  inputs: Record<string, unknown>,
  emit: EmitFn,
): Promise<RunnerResult> {
  const source = String(inputs.source_text ?? "");
  const target = String(inputs.target_language ?? "es");
  const formality = String(inputs.formality ?? "warm-but-professional");

  const system = [
    `Translate an English parent-school message into ${target}.`,
    `Tone: ${formality}.`,
    "Preserve meaning, names, and any {{placeholder}} tokens exactly. Do not add commentary.",
    "Output only the translation — no preamble.",
  ].join("\n");

  let translation = "";
  if (hasApiKey() && skill.models?.draft) {
    try {
      const modelId = skill.models.draft;
      const { text } = await generateText({
        model: modelId as unknown as LanguageModel,
        system,
        prompt: source,
        maxOutputTokens: 500,
      });
      translation = text.trim();
      await streamStub(translation, emit, /*chunkMs*/ 6);
      const structured = { translation, review_required: true };
      emit({ stage: "structured", payload: structured });
      return {
        modelUsed: modelId,
        text: translation,
        structuredOutput: structured,
      };
    } catch (err) {
      emit({
        stage: "error",
        payload: {
          message: `live model failed: ${
            err instanceof Error ? err.message : "unknown"
          }; falling back to stub`,
        },
      });
    }
  }

  translation = stubTranslation(source, target);
  await streamStub(translation, emit);
  const structured = { translation, review_required: true };
  emit({ stage: "structured", payload: structured });
  return {
    modelUsed: STUB_MARK,
    text: translation,
    structuredOutput: structured,
  };
}

function stubTranslation(source: string, target: string): string {
  const prefix: Record<string, string> = {
    es: "Hola",
    pt: "Olá",
    ht: "Bonjou",
    zh: "您好",
    ar: "مرحبا",
  };
  const marker = prefix[target] ?? "(translation)";
  return `${marker} — [stub ${target} translation of: "${source.slice(0, 80)}${
    source.length > 80 ? "…" : ""
  }"]`;
}

// ---- ops-ticket-triage (structured classifier) --------------------------

async function runTicketTriage(
  skill: Skill,
  inputs: Record<string, unknown>,
  emit: EmitFn,
): Promise<RunnerResult> {
  const subject = String(inputs.ticket_subject ?? "");
  const body = String(inputs.ticket_body ?? "");
  const role = String(inputs.submitter_role ?? "teacher");

  const system = [
    "You triage operations tickets. Return ONLY JSON, no preamble.",
    "Schema: {category, priority, rationale, needs_human}.",
    "Categories: sis-access | reporting | ai-tool | data-privacy | other.",
    "Priorities: p0 (work blocked or PII exposed) | p1 (blocked with workaround) | p2 (inconvenient) | p3 (feature request).",
    "Rationale <= 20 words; paraphrase, never echo ticket body.",
    "Set needs_human=true when category=data-privacy OR priority=p0, else false.",
  ].join("\n");

  const user = JSON.stringify(
    { ticket_subject: subject, ticket_body: body, submitter_role: role },
    null,
    2,
  );

  let structured: Record<string, unknown>;
  let modelUsed = STUB_MARK;

  if (hasApiKey() && skill.models?.classifier) {
    try {
      const modelId = skill.models.classifier;
      const { text } = await generateText({
        model: modelId as unknown as LanguageModel,
        system,
        prompt: user,
        maxOutputTokens: 300,
      });
      const json = extractJson(text);
      structured = {
        category: String(json.category ?? "other"),
        priority: String(json.priority ?? "p2"),
        rationale: String(json.rationale ?? "ambiguous — escalating"),
        needs_human: Boolean(json.needs_human ?? true),
      };
      modelUsed = modelId;
    } catch (err) {
      emit({
        stage: "error",
        payload: {
          message: `live model failed: ${
            err instanceof Error ? err.message : "unknown"
          }; falling back to stub`,
        },
      });
      structured = stubTriage(subject, body);
    }
  } else {
    structured = stubTriage(subject, body);
  }

  emit({ stage: "structured", payload: structured });
  return {
    modelUsed,
    text: JSON.stringify(structured, null, 2),
    structuredOutput: structured,
  };
}

function stubTriage(
  subject: string,
  body: string,
): Record<string, unknown> {
  const t = (subject + " " + body).toLowerCase();
  let category: string;
  if (/sis|login|password/.test(t)) category = "sis-access";
  else if (/report|dashboard/.test(t)) category = "reporting";
  else if (/ai|gpt|claude|llm/.test(t)) category = "ai-tool";
  else if (/pii|ferpa|ssn|student data|privacy/.test(t))
    category = "data-privacy";
  else category = "other";

  let priority: string;
  if (/blocked|urgent|cannot|can't/.test(t)) priority = "p1";
  else if (/asap|now/.test(t)) priority = "p1";
  else if (/request|would like|wish/.test(t)) priority = "p3";
  else priority = "p2";

  const needs_human = category === "data-privacy" || priority === "p0";
  return {
    category,
    priority,
    rationale:
      category === "sis-access"
        ? "login / access issue on the student system"
        : category === "data-privacy"
          ? "privacy-adjacent — routing to human review"
          : "routine ticket classified by keywords",
    needs_human,
  };
}

function extractJson(raw: string): Record<string, unknown> {
  // Tolerate preambles / code fences.
  const trimmed = raw.trim();
  const fence = trimmed.match(/```json\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : trimmed;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) return {};
  try {
    return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
  } catch {
    return {};
  }
}

// ---- shared stream helpers ----------------------------------------------

async function streamStub(
  text: string,
  emit: EmitFn,
  chunkMs = 12,
): Promise<void> {
  for (const chunk of text.split(/(\s+)/)) {
    if (!chunk) continue;
    emit({ stage: "draft_delta", payload: chunk });
    await new Promise((r) => setTimeout(r, chunkMs));
  }
}

// --- input validation -----------------------------------------------------

/**
 * Validate an incoming inputs payload against the skill's manifest.
 * Returns the normalized object or throws a user-readable error.
 */
export function validateSkillInputs(
  skillId: string,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const skill = getSkill(skillId);
  if (!skill) throw new Error(`unknown skill "${skillId}"`);
  const out: Record<string, unknown> = {};
  for (const input of skill.inputs ?? []) {
    const value = raw[input.id];
    const present = value !== undefined && value !== null && value !== "";
    if (!present) {
      if (input.required !== false) {
        throw new Error(`missing required input "${input.id}"`);
      }
      continue;
    }
    switch (input.type) {
      case "number": {
        const n = Number(value);
        if (Number.isNaN(n)) {
          throw new Error(
            `input "${input.id}" must be a number (got: ${String(value)})`,
          );
        }
        out[input.id] = n;
        break;
      }
      case "enum": {
        if (
          input.options &&
          !input.options.includes(String(value))
        ) {
          throw new Error(
            `input "${input.id}" must be one of: ${input.options.join(", ")}`,
          );
        }
        out[input.id] = String(value);
        break;
      }
      case "boolean": {
        out[input.id] = Boolean(value);
        break;
      }
      case "email":
      case "date":
      case "string": {
        out[input.id] = String(value);
        break;
      }
    }
  }
  return out;
}

/** Used by the /platform UI so we don't re-import getRegistry everywhere. */
export function getAllSkillIds(): string[] {
  return getRegistry().skills.map((s) => s.id);
}
