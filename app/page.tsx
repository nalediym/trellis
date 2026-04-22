import Link from "next/link";
import { ArrowRight, FileCode2, ShieldCheck, Layers } from "lucide-react";
import {
  getConnectors,
  getDlpRules,
  getPersonas,
  getPolicyBindings,
  getSkills,
} from "@/lib/manifests";
import { getCurrentPersona } from "@/lib/personas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const persona = await getCurrentPersona();
  const skills = getSkills();
  const personas = getPersonas();
  const connectors = getConnectors();
  const dlpRules = getDlpRules();
  const bindings = getPolicyBindings();
  const liveModel = Boolean(process.env.ANTHROPIC_API_KEY);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 md:py-14 space-y-14">
      <section className="max-w-3xl space-y-5">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.14em] muted">
          <span>Portfolio sketch</span>
          <span aria-hidden>·</span>
          <span>Uncommon Schools — Senior SWE, AI Solutions</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
          An AI platform for mission-driven education orgs —{" "}
          <span className="text-[color:var(--accent)]">
            declaratively configured,
          </span>{" "}
          DLP-aware, audited by design.
        </h1>
        <p className="text-[15px] md:text-base muted leading-relaxed">
          Every skill, policy, PII rule, and integration is a YAML file in{" "}
          <code className="font-mono text-[0.9em] text-[color:var(--accent)]">
            platform/
          </code>
          . A change is a PR. A rollback is{" "}
          <code className="font-mono">git revert</code>.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Link href="/skills">
            <Button size="lg">
              Open the catalog
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </Link>
          <Link href="/platform">
            <Button size="lg" variant="secondary">
              Browse manifests
            </Button>
          </Link>
        </div>

        <div className="text-[12px] muted flex flex-wrap items-center gap-2 pt-1">
          <span>Acting as</span>
          <Badge tone="accent">{persona.name}</Badge>
          <Badge tone={liveModel ? "success" : "warn"}>
            {liveModel ? "live model" : "stub mode"}
          </Badge>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Skills" value={skills.length} hint="platform/skills/*.yaml" />
        <Stat label="Personas" value={personas.length} hint="platform/personas/" />
        <Stat
          label="Bindings"
          value={bindings.length}
          hint="platform/policies/"
        />
        <Stat label="DLP rules" value={dlpRules.length} hint="platform/dlp/" />
        <Stat
          label="Connectors"
          value={connectors.length}
          hint="platform/connectors/"
        />
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        <Pillar
          icon={<FileCode2 className="h-4.5 w-4.5" aria-hidden />}
          title="Everything is a manifest"
          body="Skills, personas, policies, DLP rules, connectors — all YAML. Zod-validated at startup."
        />
        <Pillar
          icon={<ShieldCheck className="h-4.5 w-4.5" aria-hidden />}
          title="DLP on every call"
          body="Regex + similarity + classifier. Warn redacts; block fails. Banners show which rules fired."
        />
        <Pillar
          icon={<Layers className="h-4.5 w-4.5" aria-hidden />}
          title="Audited by design"
          body="Every invocation logged with persona, findings, outcome. /audit is admin-only."
        />
      </section>

      <section className="border-t border-[color:var(--border)] pt-8 space-y-4">
        <h2 className="text-sm uppercase tracking-[0.14em] muted">
          Mapped to the JD
        </h2>
        <div className="grid gap-3 md:grid-cols-2 text-[13px]">
          <JDBullet
            jd="reusable AI stack templates"
            where="platform/skills/*.yaml"
          />
          <JDBullet
            jd="low-code tools for non-technical staff"
            where="/skills + the manifest PR workflow"
          />
          <JDBullet
            jd="library of Prompt Blueprints"
            where="blueprints/ + owner/reviewers fields in skill manifests"
          />
          <JDBullet
            jd="100% compliance with PII audits"
            where="platform/dlp/*.yaml + lib/dlp.ts enforcement"
          />
          <JDBullet
            jd="secure API integrations with core databases"
            where="platform/connectors/*.yaml with scopes_allowed/forbidden"
          />
          <JDBullet
            jd="documentation of AI environments and data flows"
            where="the manifest tree IS the documentation"
          />
        </div>
      </section>

      <footer className="border-t border-[color:var(--border)] pt-6 mt-8 text-[12.5px] muted flex flex-wrap items-center gap-x-3 gap-y-1">
        <strong className="text-[color:var(--text)] font-semibold">
          Naledi Kekana
        </strong>
        <a
          href="https://www.linkedin.com/in/naledikekana/"
          target="_blank"
          rel="noreferrer"
        >
          LinkedIn
        </a>
        <a
          href="https://github.com/nalediym"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
        <span aria-hidden>·</span>
        <span>Portfolio sketch. All data is synthesized.</span>
      </footer>
    </main>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="surface p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] muted">{label}</p>
      <p className="text-2xl font-semibold tracking-tight mt-0.5">{value}</p>
      <p className="text-[11px] font-mono muted mt-1.5 truncate">{hint}</p>
    </div>
  );
}

function Pillar({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <article className="surface p-4">
      <div className="flex items-center gap-2 text-[color:var(--accent)]">
        {icon}
        <h3 className="text-[13px] font-semibold text-[color:var(--text)]">
          {title}
        </h3>
      </div>
      <p className="mt-1.5 text-[12.5px] muted leading-relaxed">{body}</p>
    </article>
  );
}

function JDBullet({ jd, where }: { jd: string; where: string }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-md border border-[color:var(--border)]">
      <ArrowRight
        className="h-3.5 w-3.5 mt-1 text-[color:var(--accent)]"
        aria-hidden
      />
      <div>
        <p className="text-[13px]">&ldquo;{jd}&rdquo;</p>
        <p className="font-mono text-[11.5px] muted mt-0.5">{where}</p>
      </div>
    </div>
  );
}
