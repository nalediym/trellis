import Link from "next/link";
import { Lock } from "lucide-react";
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

export function SkillCard({ skill, allowed, reason }: Props) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-snug">{skill.name}</h3>
        <div className="flex items-center gap-1.5">
          {!allowed && (
            <Lock
              className="h-3.5 w-3.5 text-[color:var(--text-muted)]"
              aria-label="locked"
            />
          )}
          <Badge tone={KIND_TONE[skill.kind]}>{skill.kind}</Badge>
        </div>
      </div>
      <p className="mt-1.5 text-[13px] muted leading-relaxed line-clamp-3">
        {skill.description.trim()}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(skill.dlp_rules ?? []).slice(0, 3).map((r) => (
          <span
            key={r}
            className="font-mono text-[10px] rounded bg-[color:var(--accent-soft)] px-1.5 py-0.5 text-[color:var(--accent)]"
            title={`DLP rule: ${r}`}
          >
            {r}
          </span>
        ))}
        {(skill.connectors ?? []).slice(0, 3).map((c) => (
          <span
            key={c}
            className="font-mono text-[10px] rounded border border-[color:var(--border)] px-1.5 py-0.5 muted"
            title={`Connector: ${c}`}
          >
            {c}
          </span>
        ))}
      </div>
      <div className="mt-3 text-[11px] muted font-mono">
        owner: {skill.owner} · v{skill.version}
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
        {reason && (
          <p className="mt-3 text-[11px] text-[color:var(--text-muted)] italic">
            {reason}
          </p>
        )}
      </div>
    );
  }

  return (
    <Link
      href={`/skills/${skill.id}`}
      className={cn(
        "surface block p-4 transition-all hover:border-[color:var(--accent)] hover:shadow-sm no-underline",
      )}
    >
      {body}
    </Link>
  );
}
