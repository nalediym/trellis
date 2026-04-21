/**
 * Keyword-scored retriever over the synthetic handbook chunks.
 *
 * A production system would replace this with pgvector + an embedding model
 * (the interface is the same: `search(query, k) -> Chunk[]`).
 */
import { getHandbookChunks, type Chunk } from "./handbook";

const TOKEN_RE = /[a-z0-9]+/g;

function tokenize(s: string): string[] {
  return s.toLowerCase().match(TOKEN_RE) ?? [];
}

export function search(query: string, k = 3): Chunk[] {
  const q = new Set(tokenize(query));
  if (q.size === 0) return [];

  const scored: Chunk[] = [];
  for (const chunk of getHandbookChunks()) {
    const tokens = tokenize(chunk.text + " " + chunk.heading);
    if (tokens.length === 0) continue;
    let overlap = 0;
    for (const t of tokens) if (q.has(t)) overlap += 1;
    const score = overlap / Math.sqrt(tokens.length);
    if (score > 0) scored.push({ ...chunk, score });
  }

  scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return scored.slice(0, k);
}
