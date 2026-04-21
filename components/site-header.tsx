import Link from "next/link";
import { getPersonas } from "@/lib/manifests";
import { getCurrentPersona } from "@/lib/personas";
import { PersonaSwitcher } from "@/components/persona-switcher";

export async function SiteHeader() {
  const persona = await getCurrentPersona();
  const personas = getPersonas().map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
  }));

  return (
    <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
      <div className="mx-auto max-w-6xl px-5 py-3 flex items-center gap-6">
        <Link
          href="/"
          className="no-underline text-[color:var(--text)] font-semibold tracking-tight flex items-center gap-2"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-[color:var(--accent)]" />
          Trellis
        </Link>
        <nav className="flex items-center gap-4 text-[13px]">
          <Link href="/skills" className="no-underline muted hover:text-[color:var(--accent)]">
            Skills
          </Link>
          <Link
            href="/platform"
            className="no-underline muted hover:text-[color:var(--accent)]"
          >
            Manifests
          </Link>
          <Link
            href="/connectors"
            className="no-underline muted hover:text-[color:var(--accent)]"
          >
            Connectors
          </Link>
          <Link href="/audit" className="no-underline muted hover:text-[color:var(--accent)]">
            Audit
          </Link>
        </nav>
        <div className="ml-auto">
          <PersonaSwitcher personas={personas} currentId={persona.id} />
        </div>
      </div>
    </header>
  );
}
