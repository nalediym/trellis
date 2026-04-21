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
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.14em] muted">
          Skill catalog
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          What {persona.name} can run
        </h1>
        <p className="max-w-2xl muted text-[14px] leading-relaxed">
          {allowedCount} of {skills.length} skills are available for the{" "}
          <Badge tone="accent">{persona.role}</Badge> role. Locked cards show
          the policy reason on hover — switch persona in the header to see the
          catalog re-render.
        </p>
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
