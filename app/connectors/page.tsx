import { getConnectors } from "@/lib/manifests";
import { gmailStatus } from "@/lib/connectors/gmail";
import { sisStatus } from "@/lib/connectors/sis";
import { ConnectorCard } from "@/components/connector-card";

export const dynamic = "force-dynamic";

export default function ConnectorsPage() {
  const connectors = getConnectors();

  const statuses: Record<string, string | null> = {
    handbook: null,
    gmail: gmailStatus().lastUsedAt,
    sis: sisStatus().lastUsedAt,
  };

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 md:py-12 space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.14em] muted">Connectors</p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          External systems the platform can reach
        </h1>
        <p className="max-w-3xl muted text-[14px] leading-relaxed">
          Each connector is a manifest that declares its kind, production
          scopes, and (for data systems) which fields are explicitly forbidden.
          The mocked connectors still enforce their scope rules, so code paths
          that would read a forbidden field throw in dev just like they would
          in production.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {connectors.map((c) => (
          <ConnectorCard
            key={c.id}
            connector={c}
            lastUsedAt={statuses[c.id] ?? null}
          />
        ))}
      </section>
    </main>
  );
}
