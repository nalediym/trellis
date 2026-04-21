"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ChevronDown } from "lucide-react";
import type { Persona } from "@/lib/schemas";

interface Props {
  personas: Pick<Persona, "id" | "name" | "role">[];
  currentId: string;
}

export function PersonaSwitcher({ personas, currentId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const personaId = e.target.value;
    try {
      await fetch("/api/persona", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personaId }),
      });
    } catch {
      // best-effort; UI will still refresh below
    }
    startTransition(() => router.refresh());
  };

  return (
    <label className="inline-flex items-center gap-2 text-[12px] muted">
      <span className="uppercase tracking-[0.14em]">Acting as</span>
      <span className="relative inline-flex items-center">
        <select
          aria-label="Switch persona"
          value={currentId}
          disabled={pending}
          onChange={onChange}
          className="appearance-none rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] pl-3 pr-7 py-1.5 text-[13px] text-[color:var(--text)] disabled:opacity-50"
        >
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.role}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-1.5 h-3.5 w-3.5 text-[color:var(--text-muted)]"
          aria-hidden
        />
      </span>
    </label>
  );
}
