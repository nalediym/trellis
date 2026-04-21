/**
 * Append-only audit log.
 *
 * Every skill invocation gets recorded to:
 *   1. an in-memory ring buffer (last 200 entries) — used by the /audit UI
 *   2. `.trellis-audit.jsonl` on disk — gitignored, survives process restart
 *
 * Schema:
 *   {ts, personaId, skillId, inputs_hash, dlp_findings, outcome, durationMs}
 *
 * In production this would be structured events to a log sink plus a
 * Postgres row; here it's the simplest thing that lets the visitor see
 * every call they just made.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type AuditOutcome = "allowed" | "denied" | "error" | "blocked";

export interface AuditFindingSummary {
  rule_id: string;
  severity: "warn" | "block" | "info";
  label: string;
}

export interface AuditEntry {
  ts: string;
  personaId: string;
  skillId: string;
  inputs_hash: string;
  dlp_findings: AuditFindingSummary[];
  outcome: AuditOutcome;
  durationMs: number;
  reason?: string;
}

const RING_LIMIT = 200;
const ring: AuditEntry[] = [];

function auditPath(): string {
  return path.join(process.cwd(), ".trellis-audit.jsonl");
}

function hashInputs(inputs: unknown): string {
  const json = JSON.stringify(inputs ?? null);
  return crypto.createHash("sha256").update(json).digest("hex").slice(0, 12);
}

export interface LogInvocationArgs {
  personaId: string;
  skillId: string;
  inputs: unknown;
  dlpFindings: AuditFindingSummary[];
  outcome: AuditOutcome;
  durationMs: number;
  reason?: string;
}

export function logInvocation(args: LogInvocationArgs): AuditEntry {
  const entry: AuditEntry = {
    ts: new Date().toISOString(),
    personaId: args.personaId,
    skillId: args.skillId,
    inputs_hash: hashInputs(args.inputs),
    dlp_findings: args.dlpFindings,
    outcome: args.outcome,
    durationMs: args.durationMs,
    ...(args.reason ? { reason: args.reason } : {}),
  };

  // Ring buffer
  ring.push(entry);
  if (ring.length > RING_LIMIT) ring.splice(0, ring.length - RING_LIMIT);

  // Best-effort disk persistence — never raise to the caller.
  try {
    fs.appendFileSync(auditPath(), JSON.stringify(entry) + "\n", {
      encoding: "utf-8",
    });
  } catch {
    // swallow — audit must not break a skill call.
  }
  return entry;
}

export function getRecentInvocations(limit = RING_LIMIT): AuditEntry[] {
  return ring.slice(-limit).reverse();
}

export function clearAuditBuffer(): void {
  ring.length = 0;
}
