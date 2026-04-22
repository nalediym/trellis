import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getDlpRule, getSkill } from "@/lib/manifests";
import { getCurrentPersona } from "@/lib/personas";
import { previewInvoke } from "@/lib/policy";
import { Badge } from "@/components/ui/badge";
import { SkillRunner } from "@/components/skill-runner";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SkillDetailPage({ params }: Props) {
  const { id } = await params;
  const skill = getSkill(id);
  if (!skill) notFound();

  const persona = await getCurrentPersona();
  const decision = previewInvoke({ personaId: persona.id, skillId: skill.id });

  // Default inputs from `example` on each manifest input.
  const initialInputs: Record<string, string | number | boolean> = {};
  for (const input of skill.inputs ?? []) {
    if (input.example !== undefined && input.example !== null) {
      if (typeof input.example === "string" || typeof input.example === "number") {
        initialInputs[input.id] = input.example;
      } else if (typeof input.example === "boolean") {
        initialInputs[input.id] = input.example;
      }
    }
  }

  const dlpRules = (skill.dlp_rules ?? [])
    .map((rid) => getDlpRule(rid))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 md:py-12 space-y-8">
      <Link
        href="/skills"
        className="inline-flex items-center gap-1.5 text-[13px] no-underline muted hover:text-[color:var(--accent)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        back to catalog
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em] muted">
          <span>Skill</span>
          <span aria-hidden>·</span>
          <span className="font-mono normal-case">{skill.id}</span>
          <span aria-hidden>·</span>
          <Badge tone="neutral">v{skill.version}</Badge>
          <Badge tone="accent">{skill.kind}</Badge>
        </div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          {skill.name}
        </h1>
        <p className="max-w-3xl muted text-[14px] leading-relaxed">
          {skill.description.trim()}
        </p>
        <div className="flex flex-wrap gap-1.5 text-[12px]">
          {(skill.tags ?? []).map((t) => (
            <Badge key={t} tone="neutral">
              #{t}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] muted font-mono">
          <span title={`reviewers: ${(skill.reviewers ?? []).join(", ") || "—"}`}>
            @{skill.owner}
          </span>
          {skill.models?.draft && (
            <span>
              draft ·{" "}
              <span className="text-[color:var(--accent)]">
                {skill.models.draft}
              </span>
            </span>
          )}
          {skill.models?.classifier && (
            <span>
              classifier ·{" "}
              <span className="text-[color:var(--accent)]">
                {skill.models.classifier}
              </span>
            </span>
          )}
        </div>
      </header>

      <section className="grid md:grid-cols-3 gap-3">
        <RuleSummary
          label="Policy"
          value={decision.allowed ? "Allowed" : "Denied"}
          tone={decision.allowed ? "success" : "warn"}
          detail={decision.reason}
        />
        <RuleSummary
          label="DLP"
          value={`${dlpRules.length} rule${dlpRules.length === 1 ? "" : "s"}`}
          tone="neutral"
          detail={dlpRules.map((r) => r.id).join(", ") || "—"}
        />
        <RuleSummary
          label="Connectors"
          value={`${(skill.connectors ?? []).length}`}
          tone="neutral"
          detail={(skill.connectors ?? []).join(", ") || "—"}
        />
      </section>

      <SkillRunner
        skill={skill}
        initialInputs={initialInputs}
        allowed={decision.allowed}
        denyReason={decision.allowed ? undefined : decision.reason}
      />
    </main>
  );
}

function RuleSummary({
  label,
  value,
  tone,
  detail,
}: {
  label: string;
  value: string;
  tone: "success" | "warn" | "neutral";
  detail: string;
}) {
  return (
    <div className="surface p-3 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10.5px] uppercase tracking-[0.14em] muted">
          {label}
        </span>
        <Badge tone={tone}>{value}</Badge>
      </div>
      <p className="text-[11.5px] font-mono muted truncate" title={detail}>
        {detail}
      </p>
    </div>
  );
}
