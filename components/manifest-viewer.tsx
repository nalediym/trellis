"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TreeEntry {
  section: string;
  file: string;
  id: string;
}

interface Props {
  tree: TreeEntry[];
  initialFile?: string;
}

export function ManifestViewer({ tree, initialFile }: Props) {
  const [selected, setSelected] = useState<string>(
    initialFile ?? tree[0]?.file ?? "",
  );
  const [source, setSource] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    const load = async () => {
      try {
        const resp = await fetch(
          `/api/manifests/source?file=${encodeURIComponent(selected)}`,
        );
        const text = await resp.text();
        if (cancelled) return;
        if (!resp.ok) {
          setError(text || `HTTP ${resp.status}`);
          setSource("");
        } else {
          setError(null);
          setSource(text);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "fetch failed");
          setSource("");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    // Schedule state updates for after this render, not synchronously.
    const t = setTimeout(() => {
      setLoading(true);
      load();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [selected]);

  const groupedTree = useMemo(() => {
    const out = new Map<string, TreeEntry[]>();
    for (const entry of tree) {
      const group = out.get(entry.section) ?? [];
      group.push(entry);
      out.set(entry.section, group);
    }
    return out;
  }, [tree]);

  const selectedEntry = tree.find((e) => e.file === selected);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
      <aside className="surface p-3 h-max sticky top-4 text-[13px]">
        <p className="text-[11px] uppercase tracking-[0.14em] muted mb-2 px-1">
          platform/
        </p>
        <ul className="space-y-3">
          {Array.from(groupedTree.entries()).map(([section, entries]) => (
            <li key={section}>
              <p className="font-mono text-[12px] text-[color:var(--text)] px-1 mb-1">
                {section}/
              </p>
              <ul className="space-y-0.5">
                {entries.map((e) => (
                  <li key={e.file}>
                    <button
                      type="button"
                      onClick={() => setSelected(e.file)}
                      className={cn(
                        "w-full text-left px-2 py-1 rounded font-mono text-[12px] truncate",
                        e.file === selected
                          ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                          : "text-[color:var(--text-muted)] hover:bg-[color:var(--accent-soft)]",
                      )}
                    >
                      {e.file.replace(`${section}/`, "")}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </aside>

      <section className="surface p-5 space-y-4 min-w-0">
        <header className="flex items-center justify-between gap-3 pb-3 border-b border-[color:var(--border)]">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] muted">
              raw YAML
            </p>
            <p className="font-mono text-[13px] text-[color:var(--text)]">
              platform/{selected}
            </p>
          </div>
          {loading && (
            <Loader2
              className="h-4 w-4 animate-spin text-[color:var(--accent)]"
              aria-label="loading"
            />
          )}
        </header>
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : (
          <pre className="whitespace-pre rounded-md bg-[color:var(--accent-soft)]/60 p-4 text-[12.5px] font-mono leading-relaxed overflow-x-auto">
            {source || (loading ? "loading…" : "")}
          </pre>
        )}

        {selectedEntry && (
          <Interpretation section={selectedEntry.section} id={selectedEntry.id} />
        )}
      </section>
    </div>
  );
}

function Interpretation({ section, id }: { section: string; id: string }) {
  const [open, setOpen] = useState(false);
  const note = interpretationFor(section, id);
  return (
    <div className="border-t border-[color:var(--border)] pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] muted hover:text-[color:var(--accent)]"
      >
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
        How this renders
      </button>
      {open && (
        <p className="mt-2 text-[12.5px] leading-relaxed">{note}</p>
      )}
    </div>
  );
}

function interpretationFor(section: string, id: string): string {
  switch (section) {
    case "skills":
      return `Rendered in /skills as a card; visible to personas whose role has it in platform/policies/bindings.yaml. Invocation goes through policy → input DLP → the skill runtime → output DLP → audit. Referenced DLP rules and connectors must exist (enforced at startup).`;
    case "personas":
      return `Defines one archetype (${id}). The persona switcher in the header sets a cookie that every server component reads to decide which skills to show and whether to allow /audit.`;
    case "policies":
      return `Role → skill bindings. The default is closed: a role with no binding to a skill is denied. "*" means all skills. Rate limits are per-persona-per-day, in-memory.`;
    case "dlp":
      return `Every skill names which DLP rules MUST run. Rules fire on both the input and the output of the invocation. "block" rules fail the call; "warn" rules redact in-place and show a yellow banner.`;
    case "connectors":
      return `External integrations the platform is allowed to talk to. Each connector declares its kind (static-markdown, oauth2, internal-api) and scopes. Forbidden fields are never read, even from the mock.`;
    case "schema":
      return `The JSON Schema for the corresponding manifest type. Loaded at startup and used by scripts/validate-manifests.ts to validate every file in platform/ before the server accepts a request.`;
    default:
      return `Part of the control plane.`;
  }
}
