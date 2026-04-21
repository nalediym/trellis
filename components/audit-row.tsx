"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AuditEntry } from "@/lib/audit";

const TONE_FOR_OUTCOME: Record<
  AuditEntry["outcome"],
  "success" | "warn" | "danger"
> = {
  allowed: "success",
  denied: "warn",
  blocked: "danger",
  error: "danger",
};

export function AuditRow({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);
  const actionableFindings = entry.dlp_findings.filter(
    (f) => f.severity !== "info",
  );

  return (
    <>
      <tr
        className={cn(
          "border-t border-[color:var(--border)] cursor-pointer hover:bg-[color:var(--accent-soft)]/40",
          open && "bg-[color:var(--accent-soft)]/40",
        )}
        onClick={() => setOpen((o) => !o)}
      >
        <td className="px-3 py-2 font-mono text-[12px]">
          <ChevronRight
            aria-hidden
            className={cn(
              "h-3.5 w-3.5 inline-block transition-transform",
              open && "rotate-90",
            )}
          />{" "}
          {entry.ts.replace("T", " ").slice(0, 19)}
        </td>
        <td className="px-3 py-2 text-[12px]">{entry.personaId}</td>
        <td className="px-3 py-2 font-mono text-[12px]">{entry.skillId}</td>
        <td className="px-3 py-2">
          <Badge tone={TONE_FOR_OUTCOME[entry.outcome]}>{entry.outcome}</Badge>
        </td>
        <td className="px-3 py-2 text-[12px]">
          {actionableFindings.length > 0
            ? `${actionableFindings.length}`
            : "—"}
        </td>
        <td className="px-3 py-2 text-[12px] text-right">
          {entry.durationMs} ms
        </td>
      </tr>
      {open && (
        <tr className="border-t border-[color:var(--border)] bg-[color:var(--accent-soft)]/30">
          <td colSpan={6} className="px-4 py-3">
            <dl className="grid grid-cols-2 gap-2 text-[12px] font-mono">
              <dt className="muted">ts</dt>
              <dd>{entry.ts}</dd>
              <dt className="muted">inputs_hash</dt>
              <dd>{entry.inputs_hash}</dd>
              {entry.reason && (
                <>
                  <dt className="muted">reason</dt>
                  <dd>{entry.reason}</dd>
                </>
              )}
            </dl>
            {entry.dlp_findings.length > 0 && (
              <div className="mt-3">
                <p className="text-[11px] uppercase tracking-[0.14em] muted">
                  DLP findings
                </p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {entry.dlp_findings.map((f, i) => (
                    <li key={`${f.rule_id}-${i}`}>
                      <Badge
                        tone={f.severity === "block" ? "danger" : "warn"}
                      >
                        {f.rule_id} · {f.label}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
