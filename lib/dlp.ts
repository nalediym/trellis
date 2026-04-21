/**
 * DLP (Data Loss Prevention) scanner — generalization of the regex-only
 * redactor in `lib/redact.ts`.
 *
 * Three rule kinds, declared in `platform/dlp/*.yaml`:
 *
 *   1. classification — regex block + warn (pii-core)
 *      block findings hard-fail the invocation; warn findings trigger
 *      the yellow banner and redact in-place.
 *
 *   2. similarity — shingled similarity compare (ticket-paraphrase)
 *      Compares a named output field against a named input field; if
 *      overlap > threshold, the output field is replaced with the
 *      rule's `replacement` string.
 *
 *   3. classifier — LLM classifier (fern-minors)
 *      Listed in the manifest but SHIPS STUBBED in the current deployment
 *      — returns zero findings. Replacing the stub with a real Haiku call
 *      is a one-line change. Every place this matters is noted in-line.
 *
 * The regex layer (pii-core) is the production-tested one. Every skill's
 * `dlp_rules` list names which rules MUST run; a skill that omits a rule
 * cannot accidentally skip it — the scanner ignores rules not listed.
 */
import { getDlpRule } from "./manifests";
import type { DlpRule } from "./schemas";

type SimilarityRule = Extract<DlpRule, { kind: "similarity" }>;
type ClassificationRule = Extract<DlpRule, { kind: "classification" }>;

export type DlpSeverity = "warn" | "block" | "info";

export interface DlpFinding {
  rule_id: string;
  rule_kind: DlpRule["kind"];
  severity: DlpSeverity;
  label: string;
  span?: string;
  details?: string;
}

export interface DlpScanResult {
  findings: DlpFinding[];
  // The (possibly-transformed) output. When rules redact, this is the
  // redacted version. When rules block, the caller must not surface it.
  transformed: string;
  blocked: boolean;
}

export interface DlpScanInputs {
  /** The text (or JSON stringify'd output) to scan. */
  output: string;
  /** The DLP rule IDs to enforce — names from `skill.dlp_rules`. */
  dlpRuleIds: string[];
  /**
   * Optional structured-output field-map used by the similarity rule,
   * which needs to compare named fields rather than arbitrary text.
   */
  structuredOutput?: Record<string, unknown>;
  /** Optional input payload used by the similarity rule. */
  inputs?: Record<string, unknown>;
}

export function scanOutput({
  output,
  dlpRuleIds,
  structuredOutput,
  inputs,
}: DlpScanInputs): DlpScanResult {
  const findings: DlpFinding[] = [];
  let transformed = output;
  let blocked = false;
  let structured = structuredOutput ? { ...structuredOutput } : undefined;

  for (const ruleId of dlpRuleIds) {
    const rule = getDlpRule(ruleId);
    if (!rule) {
      findings.push({
        rule_id: ruleId,
        rule_kind: "classification",
        severity: "info",
        label: "unknown-rule",
        details: `DLP rule "${ruleId}" declared but not found in registry`,
      });
      continue;
    }

    if (rule.kind === "classification") {
      const res = applyClassificationRule(rule, transformed);
      findings.push(...res.findings);
      transformed = res.transformed;
      if (res.blocked) blocked = true;
    } else if (rule.kind === "similarity") {
      const res = applySimilarityRule(rule, structured, inputs);
      findings.push(...res.findings);
      if (res.structuredOutput) structured = res.structuredOutput;
    } else if (rule.kind === "classifier") {
      // STUB: the fern-minors classifier rule ships stubbed in the current
      // deployment. Replacing this with a real Haiku call is a one-line
      // change; see platform/dlp/fern-minors.yaml for the production plan.
      // We still record an "info" finding so the audit log shows the
      // rule was considered.
      findings.push({
        rule_id: rule.id,
        rule_kind: "classifier",
        severity: "info",
        label: "classifier-stubbed",
        details: `${rule.id} ships with the LLM classifier layer stubbed`,
      });
    }
  }

  // If the similarity rule rewrote a structured field, the caller may
  // want the pretty-printed JSON back in `transformed` too.
  if (structured) {
    transformed = JSON.stringify(structured, null, 2);
  }

  return { findings, transformed, blocked };
}

// ---- regex classification ------------------------------------------------

function applyClassificationRule(
  rule: ClassificationRule,
  text: string,
): { findings: DlpFinding[]; transformed: string; blocked: boolean } {
  const findings: DlpFinding[] = [];
  let out = text;
  let blocked = false;
  const redactTemplate = rule.redact_with ?? "[{label}]";

  // Block rules fire first.
  for (const r of rule.classifications.block ?? []) {
    const pattern = compile(r.pattern);
    const matches = Array.from(out.matchAll(pattern));
    for (const m of matches) {
      findings.push({
        rule_id: rule.id,
        rule_kind: "classification",
        severity: "block",
        label: r.label,
        span: m[0],
      });
      blocked = true;
    }
    // Redact the match too so the string-dump never leaks the original.
    out = out.replace(pattern, redactTemplate.replace("{label}", r.label));
  }

  for (const r of rule.classifications.warn ?? []) {
    const pattern = compile(r.pattern);
    const matches = Array.from(out.matchAll(pattern));
    for (const m of matches) {
      findings.push({
        rule_id: rule.id,
        rule_kind: "classification",
        severity: "warn",
        label: r.label,
        span: m[0],
      });
    }
    out = out.replace(pattern, redactTemplate.replace("{label}", r.label));
  }

  return { findings, transformed: out, blocked };
}

function compile(source: string): RegExp {
  try {
    return new RegExp(source, "g");
  } catch (err) {
    throw new Error(
      `DLP rule regex failed to compile: ${source} (${
        err instanceof Error ? err.message : "unknown"
      })`,
    );
  }
}

// ---- similarity ----------------------------------------------------------

function applySimilarityRule(
  rule: SimilarityRule,
  structuredOutput: Record<string, unknown> | undefined,
  inputs: Record<string, unknown> | undefined,
): {
  findings: DlpFinding[];
  structuredOutput: Record<string, unknown> | undefined;
} {
  if (!structuredOutput || !inputs) {
    return { findings: [], structuredOutput };
  }
  const outField = rule.compare_output_field;
  const inField = rule.to_input_field;
  const outValue = structuredOutput[outField];
  const inValue = inputs[inField];
  if (typeof outValue !== "string" || typeof inValue !== "string") {
    return { findings: [], structuredOutput };
  }
  const sim = shingleSimilarity(outValue, inValue);
  if (sim < rule.similarity_threshold) {
    return { findings: [], structuredOutput };
  }

  // Above threshold — redact per rule config.
  const next = { ...structuredOutput };
  if (rule.on_finding === "redact") {
    next[outField] = rule.replacement;
  }
  return {
    findings: [
      {
        rule_id: rule.id,
        rule_kind: "similarity",
        severity: rule.on_finding === "block" ? "block" : "warn",
        label: `similarity(${outField} ~ ${inField}) = ${sim.toFixed(2)}`,
        details: `exceeds threshold ${rule.similarity_threshold}`,
      },
    ],
    structuredOutput: next,
  };
}

/**
 * Simple word-level Jaccard similarity on 3-gram shingles. Fast, no
 * dependencies, plenty for the paraphrase-guard use case.
 */
function shingleSimilarity(a: string, b: string, n = 3): number {
  const toShingles = (s: string): Set<string> => {
    const tokens = s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    if (tokens.length < n) return new Set(tokens);
    const shingles = new Set<string>();
    for (let i = 0; i <= tokens.length - n; i++) {
      shingles.add(tokens.slice(i, i + n).join(" "));
    }
    return shingles;
  };
  const A = toShingles(a);
  const B = toShingles(b);
  if (A.size === 0 || B.size === 0) return 0;
  let intersect = 0;
  for (const s of A) if (B.has(s)) intersect += 1;
  const union = A.size + B.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

/** Summary string for the banner copy. */
export function summarizeFindings(findings: DlpFinding[]): string {
  if (findings.length === 0) return "no DLP findings";
  const byLabel = new Map<string, number>();
  for (const f of findings) {
    if (f.severity === "info") continue;
    byLabel.set(f.label, (byLabel.get(f.label) ?? 0) + 1);
  }
  if (byLabel.size === 0) return "rules considered; no findings";
  return (
    "findings: " +
    Array.from(byLabel.entries())
      .map(([label, n]) => `${n} × ${label}`)
      .join(", ")
  );
}
