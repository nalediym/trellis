import { getSkills } from "@/lib/manifests";
import { getCurrentPersona } from "@/lib/personas";
import { previewInvoke } from "@/lib/policy";
import { SkillCard } from "@/components/skill-card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function SkillsPage() {
  const persona = await getCurrentPersona();
  const skills = getSkills();

  const decorated = skills.map((skill) => {
    const decision = previewInvoke({ personaId: persona.id, skillId: skill.id });
    return { skill, decision };
  });

  const allowedCount = decorated.filter((d) => d.decision.allowed).length;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 md:py-14 space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.14em] muted">
            Skill catalog
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            What {persona.name} can run
          </h1>
        </div>
        <div className="flex items-center gap-2 text-[12px] muted">
          <Badge tone="accent">{persona.role}</Badge>
          <span>
            {allowedCount} / {skills.length} available
          </span>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {decorated.map(({ skill, decision }) => (
          <SkillCard
            key={skill.id}
            skill={skill}
            allowed={decision.allowed}
            reason={decision.allowed ? undefined : decision.reason}
          />
        ))}
      </section>
    </main>
  );
}
