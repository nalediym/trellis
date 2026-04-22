"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ArrowRight, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DlpWarning } from "@/components/dlp-warning";
import type { Skill } from "@/lib/schemas";
import type { DlpScanResult } from "@/lib/dlp";

interface Props {
  skill: Skill;
  initialInputs: Record<string, string | number | boolean>;
  allowed: boolean;
  denyReason?: string;
}

type StageEvent =
  | { stage: "policy"; payload: { allowed: boolean; reason: string; remainingRateLimit: number | null } }
  | { stage: "retrieval"; payload: { path: string; heading: string; score: number }[] }
  | { stage: "dlp_input"; payload: DlpScanResult }
  | { stage: "draft_delta"; payload: string }
  | { stage: "structured"; payload: Record<string, unknown> }
  | { stage: "dlp_output"; payload: DlpScanResult }
  | { stage: "done"; payload: { outcome: string; reason: string; modelUsed: string; stubMode: boolean; dlpSummary?: string } }
  | { stage: "error"; payload: { message: string } };

export function SkillRunner({
  skill,
  initialInputs,
  allowed,
  denyReason,
}: Props) {
  const [values, setValues] = useState<
    Record<string, string | number | boolean>
  >(initialInputs);
  const [isStreaming, setStreaming] = useState(false);
  const [policy, setPolicy] = useState<StageEvent & { stage: "policy" } | null>(
    null,
  );
  const [retrieval, setRetrieval] = useState<StageEvent & { stage: "retrieval" } | null>(
    null,
  );
  const [dlpInput, setDlpInput] = useState<StageEvent & { stage: "dlp_input" } | null>(
    null,
  );
  const [dlpOutput, setDlpOutput] = useState<StageEvent & { stage: "dlp_output" } | null>(
    null,
  );
  const [draft, setDraft] = useState("");
  const [structured, setStructured] = useState<Record<string, unknown> | null>(
    null,
  );
  const [done, setDone] = useState<StageEvent & { stage: "done" } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reset = () => {
    setPolicy(null);
    setRetrieval(null);
    setDlpInput(null);
    setDlpOutput(null);
    setDraft("");
    setStructured(null);
    setDone(null);
    setErrorMessage(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!allowed || isStreaming) return;
    setStreaming(true);
    reset();

    try {
      const resp = await fetch(`/api/skills/${skill.id}/invoke`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inputs: values }),
      });

      if (!resp.ok || !resp.body) {
        const text = await resp.text().catch(() => "");
        let msg = text;
        try {
          const j = JSON.parse(text);
          msg = j.detail || j.error || text;
        } catch {}
        throw new Error(`${resp.status}: ${msg}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done: finished } = await reader.read();
        if (finished) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line) continue;
          try {
            apply(JSON.parse(line) as StageEvent);
          } catch {
            // skip malformed
          }
        }
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "unexpected streaming error",
      );
    } finally {
      setStreaming(false);
    }
  };

  const apply = (ev: StageEvent) => {
    switch (ev.stage) {
      case "policy":
        setPolicy(ev);
        return;
      case "retrieval":
        setRetrieval(ev);
        return;
      case "dlp_input":
        setDlpInput(ev);
        return;
      case "draft_delta":
        setDraft((prev) => prev + ev.payload);
        return;
      case "structured":
        setStructured(ev.payload);
        return;
      case "dlp_output":
        setDlpOutput(ev);
        return;
      case "done":
        setDone(ev);
        return;
      case "error":
        setErrorMessage(ev.payload.message);
        return;
    }
  };

  const ready = useMemo(
    () => skill.inputs?.every((i) => (i.required === false ? true : !!values[i.id])) ?? true,
    [skill.inputs, values],
  );

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6">
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] muted mb-2">
          Inputs
        </h2>
        <form onSubmit={onSubmit} className="surface p-5 space-y-4">
          {!allowed && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-[12.5px] text-amber-900 flex items-center gap-2">
              <Lock className="h-3.5 w-3.5" aria-hidden />
              <span>{denyReason || "Not permitted for this persona"}</span>
            </div>
          )}

          <div className="grid gap-4">
            {(skill.inputs ?? []).map((input) => (
              <InputField
                key={input.id}
                input={input}
                value={values[input.id] ?? ""}
                onChange={(v) =>
                  setValues((prev) => ({ ...prev, [input.id]: v }))
                }
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              type="submit"
              disabled={!allowed || isStreaming || !ready}
              aria-busy={isStreaming}
            >
              {isStreaming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Running…
                </>
              ) : (
                <>
                  Invoke
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </>
              )}
            </Button>
            {skill.disallowed_phrasings &&
              skill.disallowed_phrasings.length > 0 && (
                <span
                  className="text-[11px] muted font-mono truncate"
                  title={`Disallowed phrasings: ${skill.disallowed_phrasings.join(", ")}`}
                >
                  ≠ {skill.disallowed_phrasings.join(", ")}
                </span>
              )}
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] muted mb-2">
          Pipeline
        </h2>
        <div className="surface p-5 space-y-5 min-h-[200px]">
          {errorMessage && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <strong className="font-semibold">Error.</strong> {errorMessage}
            </div>
          )}

          {!isStreaming && !policy && !errorMessage && (
            <p className="muted text-[12.5px]">
              Invoke to stream: policy → DLP → retrieval → model → DLP → audit.
            </p>
          )}

          {policy && (
            <Stage label="Policy" state="done">
              <p className="text-[13px]">
                {policy.payload.allowed ? (
                  <>
                    <span className="text-emerald-700 font-medium">
                      Allowed.
                    </span>{" "}
                    {policy.payload.remainingRateLimit !== null && (
                      <span className="muted">
                        · {policy.payload.remainingRateLimit} / day remaining
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-red-700 font-medium">Denied.</span>{" "}
                    {policy.payload.reason}
                  </>
                )}
              </p>
            </Stage>
          )}

          {dlpInput && (
            <Stage label="DLP · input" state="done">
              <DlpWarning
                stage="input"
                findings={dlpInput.payload.findings}
                blocked={dlpInput.payload.blocked}
              />
            </Stage>
          )}

          {retrieval && (
            <Stage label="Retrieval" state="done">
              {retrieval.payload.length === 0 && (
                <p className="muted text-[13px]">
                  No handbook chunks retrieved.
                </p>
              )}
              {retrieval.payload.length > 0 && (
                <ul className="space-y-1.5">
                  {retrieval.payload.map((s, i) => (
                    <li
                      key={`${s.path}-${i}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-[color:var(--border)] px-3 py-1.5 text-[12.5px]"
                    >
                      <span className="font-mono truncate">
                        {s.path}
                        <span className="muted"> # {s.heading}</span>
                      </span>
                      <Badge tone="accent">score {s.score.toFixed(3)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Stage>
          )}

          {(isStreaming || draft || structured) && (
            <Stage
              label="Model output"
              subtitle={
                done?.payload?.modelUsed
                  ? `Via ${done.payload.modelUsed}`
                  : undefined
              }
              state={done ? "done" : "loading"}
            >
              {structured && (
                <pre className="whitespace-pre-wrap break-words rounded-md bg-[color:var(--accent-soft)] p-4 text-[12.5px] font-mono leading-relaxed">
                  {JSON.stringify(structured, null, 2)}
                </pre>
              )}
              {!structured && (
                <pre className="whitespace-pre-wrap break-words rounded-md bg-[color:var(--accent-soft)] p-4 text-[13.5px] leading-relaxed font-sans">
                  {draft}
                  {isStreaming && (
                    <span className="inline-block w-[7px] h-[1em] align-[-2px] ml-0.5 bg-[color:var(--accent)] animate-pulse" />
                  )}
                </pre>
              )}
            </Stage>
          )}

          {dlpOutput && (
            <Stage label="DLP · output" state="done">
              <DlpWarning
                stage="output"
                findings={dlpOutput.payload.findings}
                blocked={dlpOutput.payload.blocked}
              />
            </Stage>
          )}

          {done && (
            <div className="rounded-md border border-[color:var(--border)] bg-[color:var(--accent-soft)]/30 p-3 text-[12.5px]">
              <span className="muted">outcome: </span>
              <Badge
                tone={
                  done.payload.outcome === "allowed"
                    ? "success"
                    : done.payload.outcome === "denied"
                      ? "warn"
                      : "danger"
                }
              >
                {done.payload.outcome}
              </Badge>
              {done.payload.stubMode && (
                <>
                  {" "}
                  <Badge tone="warn">stub mode</Badge>
                </>
              )}
              {done.payload.dlpSummary && (
                <span className="muted"> · {done.payload.dlpSummary}</span>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function InputField({
  input,
  value,
  onChange,
}: {
  input: Skill["inputs"][number];
  value: string | number | boolean;
  onChange: (v: string | number | boolean) => void;
}) {
  const id = `input-${input.id}`;
  const isLong =
    input.type === "string" && /body|text|question|excerpt/i.test(input.id);

  if (input.type === "enum" && input.options) {
    return (
      <div>
        <label
          htmlFor={id}
          className="block text-[12px] font-medium mb-1.5 text-[color:var(--text)]"
        >
          {input.label}
        </label>
        <select
          id={id}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className="block w-full rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm"
        >
          <option value="">— choose —</option>
          {input.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (isLong) {
    return (
      <div>
        <label
          htmlFor={id}
          className="block text-[12px] font-medium mb-1.5 text-[color:var(--text)]"
        >
          {input.label}
        </label>
        <textarea
          id={id}
          rows={3}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={input.placeholder}
          className="block w-full rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm resize-y min-h-[72px]"
        />
      </div>
    );
  }

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[12px] font-medium mb-1.5 text-[color:var(--text)]"
      >
        {input.label}
      </label>
      <input
        id={id}
        type={input.type === "number" ? "number" : "text"}
        inputMode={input.type === "number" ? "numeric" : "text"}
        value={String(value ?? "")}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(
            input.type === "number" && raw !== "" ? Number(raw) : raw,
          );
        }}
        placeholder={input.placeholder}
        className="block w-full rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm"
      />
    </div>
  );
}

function Stage({
  label,
  subtitle,
  state,
  children,
}: {
  label: string;
  subtitle?: string;
  state: "idle" | "loading" | "done";
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] muted">
            {label}
          </div>
          {subtitle && <div className="text-[12px] muted">{subtitle}</div>}
        </div>
        {state === "loading" && (
          <Loader2
            className="h-3.5 w-3.5 animate-spin text-[color:var(--accent)]"
            aria-label="loading"
          />
        )}
        {state === "done" && <Badge tone="success">done</Badge>}
      </div>
      <div className={cn(state === "idle" && "muted text-[13px]")}>
        {children}
      </div>
    </div>
  );
}
