"use client";

import { useState } from "react";
import { ChevronDown, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DlpFinding } from "@/lib/dlp";

interface Props {
  stage: "input" | "output";
  findings: DlpFinding[];
  blocked?: boolean;
}

export function DlpWarning({ stage, findings, blocked = false }: Props) {
  const actionable = findings.filter((f) => f.severity !== "info");
  const hasAny = actionable.length > 0;

  if (blocked) {
    return (
      <Shell
        tone="danger"
        icon={<ShieldAlert className="h-4 w-4" aria-hidden />}
        headline={`${stageLabel(stage)} blocked`}
        count={actionable.length}
        findings={actionable}
      />
    );
  }
  if (hasAny) {
    return (
      <Shell
        tone="warn"
        icon={<ShieldQuestion className="h-4 w-4" aria-hidden />}
        headline={`${stageLabel(stage)} redacted`}
        count={actionable.length}
        findings={actionable}
      />
    );
  }
  return (
    <Shell
      tone="ok"
      icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
      headline={`${stageLabel(stage)} clean`}
    />
  );
}

function stageLabel(stage: "input" | "output") {
  return stage === "input" ? "Input" : "Output";
}

function Shell({
  tone,
  icon,
  headline,
  count,
  findings,
}: {
  tone: "ok" | "warn" | "danger";
  icon: React.ReactNode;
  headline: string;
  count?: number;
  findings?: DlpFinding[];
}) {
  const [open, setOpen] = useState(false);
  const expandable = Boolean(findings && findings.length > 0);
  const palette = TONE_STYLES[tone];

  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-[13px]",
        palette.border,
        palette.bg,
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("shrink-0", palette.icon)}>{icon}</span>
        <span className={cn("font-medium", palette.text)}>{headline}</span>
        {typeof count === "number" && count > 0 && (
          <Badge tone={tone === "danger" ? "danger" : "warn"}>
            {count} rule{count === 1 ? "" : "s"}
          </Badge>
        )}
        {expandable && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "ml-auto inline-flex items-center gap-1 text-[11px] uppercase tracking-wider",
              palette.text,
              "opacity-70 hover:opacity-100",
            )}
            aria-expanded={open}
          >
            details
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                open && "rotate-180",
              )}
              aria-hidden
            />
          </button>
        )}
      </div>
      {expandable && open && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {findings!.map((f, i) => (
            <li key={`${f.rule_id}-${i}`}>
              <Badge tone={f.severity === "block" ? "danger" : "warn"}>
                {f.rule_id} · {f.label}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const TONE_STYLES = {
  ok: {
    border: "border-emerald-200",
    bg: "bg-emerald-50/60",
    text: "text-emerald-900",
    icon: "text-emerald-700",
  },
  warn: {
    border: "border-amber-200",
    bg: "bg-amber-50/60",
    text: "text-amber-900",
    icon: "text-amber-700",
  },
  danger: {
    border: "border-red-200",
    bg: "bg-red-50/70",
    text: "text-red-900",
    icon: "text-red-700",
  },
} as const;
