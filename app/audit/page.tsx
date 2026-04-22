import Link from "next/link";
import { getCurrentPersona, isAdminPersona } from "@/lib/personas";
import { getRecentInvocations } from "@/lib/audit";
import { AuditRow } from "@/components/audit-row";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const persona = await getCurrentPersona();

  if (!isAdminPersona(persona)) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-14">
        <div className="surface p-6 space-y-3">
          <p className="text-xs uppercase tracking-[0.14em] muted">
            403 · Forbidden
          </p>
          <h1 className="text-xl font-semibold">Audit is admin-only.</h1>
          <p className="muted text-[13px]">
            Acting as <Badge tone="accent">{persona.name}</Badge>. Switch to{" "}
            <Badge tone="neutral">Data &amp; IT Admin</Badge> in the header.
          </p>
        </div>
      </main>
    );
  }

  const entries = getRecentInvocations();

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 md:py-12 space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.14em] muted">Audit</p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Last {entries.length} invocations
          </h1>
        </div>
        <code
          className="font-mono text-[11.5px] muted"
          title="Ring buffer + JSONL on disk. Postgres + dashboards in prod."
        >
          .trellis-audit.jsonl
        </code>
      </header>

      {entries.length === 0 ? (
        <div className="surface p-6 text-[14px] muted">
          No invocations yet this session — click through to{" "}
          <Link href="/skills">the skill catalog</Link>, run a skill, then come
          back.
        </div>
      ) : (
        <div className="overflow-x-auto surface">
          <table className="w-full text-[13px]">
            <thead className="bg-[color:var(--accent-soft)] text-[11px] uppercase tracking-[0.12em] muted">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Timestamp</th>
                <th className="text-left px-3 py-2 font-medium">Persona</th>
                <th className="text-left px-3 py-2 font-medium">Skill</th>
                <th className="text-left px-3 py-2 font-medium">Outcome</th>
                <th className="text-left px-3 py-2 font-medium">DLP</th>
                <th className="text-right px-3 py-2 font-medium">Duration</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <AuditRow key={`${e.ts}-${e.inputs_hash}`} entry={e} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
