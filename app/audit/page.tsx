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
          <h1 className="text-xl font-semibold">
            The audit log is admin-only.
          </h1>
          <p className="muted text-[13.5px]">
            You&apos;re currently acting as{" "}
            <Badge tone="accent">{persona.name}</Badge>. Switch to the{" "}
            <Badge tone="neutral">Data & IT Admin</Badge> persona in the header
            to see the log of every skill invocation on this deployment.
          </p>
          <p className="muted text-[12.5px]">
            The guard is enforced in the page server component and again at the{" "}
            <code className="font-mono">/api/audit</code> endpoint; a direct
            fetch returns 403 for any non-admin cookie.
          </p>
        </div>
      </main>
    );
  }

  const entries = getRecentInvocations();

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 md:py-12 space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.14em] muted">Audit</p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Last {entries.length} invocations
        </h1>
        <p className="max-w-3xl muted text-[14px] leading-relaxed">
          In-memory ring buffer backed by a JSONL file on disk
          (<code className="font-mono">.trellis-audit.jsonl</code>). Every skill
          invocation is recorded with persona, DLP findings, outcome, and
          duration. In production this would be a Postgres table + dashboards.
          Here it&apos;s the smallest thing that lets a visitor see what they
          just did.
        </p>
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
