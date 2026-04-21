import { Badge } from "@/components/ui/badge";
import type { Connector } from "@/lib/schemas";

interface Props {
  connector: Connector;
  lastUsedAt: string | null;
}

const KIND_LABEL: Record<Connector["kind"], string> = {
  "static-markdown": "static markdown",
  oauth2: "OAuth 2.0",
  "internal-api": "internal API",
  mcp: "MCP server",
};

export function ConnectorCard({ connector, lastUsedAt }: Props) {
  const isMocked = (connector.status ?? "real") !== "real";
  return (
    <article className="surface p-4 space-y-3">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{connector.name}</h3>
          <p className="font-mono text-[11px] muted">{connector.id}</p>
        </div>
        <Badge tone={isMocked ? "warn" : "success"}>
          {connector.status ?? "real"}
        </Badge>
      </header>

      <p className="text-[13px] leading-relaxed">
        {connector.description.trim()}
      </p>

      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-[12px]">
        <dt className="muted">kind</dt>
        <dd className="font-mono">{KIND_LABEL[connector.kind]}</dd>
        <dt className="muted">owner</dt>
        <dd className="font-mono">{connector.owner}</dd>
        <dt className="muted">version</dt>
        <dd className="font-mono">v{connector.version}</dd>
        <dt className="muted">last used</dt>
        <dd className="font-mono">{lastUsedAt ?? "—"}</dd>
      </dl>

      {connector.scopes_allowed && connector.scopes_allowed.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] muted mb-1.5">
            scopes allowed
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {connector.scopes_allowed.map((s) => (
              <li
                key={s}
                className="font-mono text-[10.5px] rounded bg-emerald-50 text-emerald-800 border border-emerald-100 px-1.5 py-0.5"
              >
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
      {connector.scopes_forbidden && connector.scopes_forbidden.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] muted mb-1.5">
            scopes forbidden
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {connector.scopes_forbidden.map((s) => (
              <li
                key={s}
                className="font-mono text-[10.5px] rounded bg-red-50 text-red-700 border border-red-100 px-1.5 py-0.5"
              >
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
      {connector.production_scopes && (
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] muted mb-1.5">
            production scopes
          </p>
          <ul className="flex flex-col gap-1">
            {connector.production_scopes.map((s) => (
              <li
                key={s}
                className="font-mono text-[10.5px] text-[color:var(--text-muted)]"
              >
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
