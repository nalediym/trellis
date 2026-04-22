import Link from "next/link";
import {
  Lock,
  Mail,
  FileText,
  Languages,
  GraduationCap,
  Ticket,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Skill } from "@/lib/schemas";

interface Props {
  skill: Skill;
  allowed: boolean;
  reason?: string;
}

const KIND_TONE: Record<
  Skill["kind"],
  "accent" | "success" | "warn" | "neutral"
> = {
  "streaming-agent": "accent",
  "one-shot": "success",
  classifier: "warn",
  tool: "neutral",
};

const SKILL_ICON: Record<string, LucideIcon> = {
  "parent-comms-attendance": Mail,
  "lesson-plan-qa": GraduationCap,
  "policy-handbook-summary": FileText,
  "parent-contact-translate": Languages,
  "ops-ticket-triage": Ticket,
};

export function SkillCard({ skill, allowed, reason }: Props) {
  const Icon = SKILL_ICON[skill.id] ?? Sparkles;
  const dlpCount = (skill.dlp_rules ?? []).length;
  const connectorCount = (skill.connectors ?? []).length;

  const body = (
    <>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg",
            allowed
              ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
              : "bg-[color:var(--border)]/40 text-[color:var(--text-muted)]",
          )}
          aria-hidden
        >
          <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="text-[14px] font-semibold leading-snug truncate">
              {skill.name}
            </h3>
            {!allowed && (
              <Lock
                className="h-3.5 w-3.5 text-[color:var(--text-muted)] shrink-0"
                aria-label="locked"
              />
            )}
          </div>
          <p className="mt-0.5 text-[12.5px] muted leading-snug line-clamp-2">
            {skill.description.trim()}
          </p>
        </div>
      </div>

      <div className="mt-3.5 flex items-center gap-1.5">
        <Badge tone={KIND_TONE[skill.kind]}>{skill.kind}</Badge>
        {dlpCount > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] px-1.5 py-0.5 text-[10.5px] font-mono muted"
            title={(skill.dlp_rules ?? []).join(", ")}
          >
            dlp · {dlpCount}
          </span>
        )}
        {connectorCount > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] px-1.5 py-0.5 text-[10.5px] font-mono muted"
            title={(skill.connectors ?? []).join(", ")}
          >
            conn · {connectorCount}
          </span>
        )}
      </div>
    </>
  );

  if (!allowed) {
    return (
      <div
        className={cn(
          "surface block p-4 opacity-60 cursor-not-allowed relative",
        )}
        aria-disabled="true"
        title={reason ?? "not permitted for this persona"}
      >
        {body}
      </div>
    );
  }

  return (
    <Link
      href={`/skills/${skill.id}`}
      className={cn(
        "surface group block p-4 no-underline transition-all",
        "hover:border-[color:var(--accent)] hover:shadow-sm hover:-translate-y-[1px]",
      )}
    >
      {body}
    </Link>
  );
}
