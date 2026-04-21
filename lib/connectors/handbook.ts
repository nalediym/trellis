/**
 * Handbook connector — real.
 *
 * Reads `handbook/*.md` at startup, splits on headings, and exposes a
 * keyword-scored retrieval API. In production this would be a pgvector
 * index rebuilt nightly from the Uncommon wiki via dbt. Here it's 3
 * static markdown files — enough shape, zero infra.
 *
 * The wrapping in this file exists so the UI sees a typed `HandbookConnector`
 * interface; the underlying reader is reused from `lib/handbook.ts`.
 */
import { getHandbookChunks, type Chunk } from "../handbook";
import { search } from "../retriever";

export interface HandbookSource {
  path: string;
  heading: string;
  score: number;
  text: string;
}

export interface HandbookConnector {
  kind: "static-markdown";
  listDocs(): { path: string; heading: string }[];
  retrieve(query: string, k?: number): HandbookSource[];
  getChunk(docPath: string, heading: string): Chunk | undefined;
  sectionText(sectionId: string): string;
}

function listDocs(): { path: string; heading: string }[] {
  return getHandbookChunks().map((c) => ({ path: c.path, heading: c.heading }));
}

function retrieve(query: string, k = 3): HandbookSource[] {
  return search(query, k).map((c) => ({
    path: c.path,
    heading: c.heading,
    score: Number((c.score ?? 0).toFixed(4)),
    text: c.text,
  }));
}

function getChunk(docPath: string, heading: string): Chunk | undefined {
  return getHandbookChunks().find(
    (c) => c.path === docPath && c.heading === heading,
  );
}

/**
 * Return the full markdown for a logical section. The policy-handbook
 * summary skill uses short section IDs (attendance, parent-communication,
 * pii-handling) that map to the three handbook files.
 */
function sectionText(sectionId: string): string {
  const map: Record<string, string> = {
    attendance: "attendance-policies.md",
    "parent-communication": "parent-communication-guidelines.md",
    "pii-handling": "pii-handling.md",
  };
  const fileName = map[sectionId];
  if (!fileName) return "";
  const parts = getHandbookChunks().filter((c) => c.path === fileName);
  return parts
    .map((c) => `## ${c.heading}\n\n${c.text}`)
    .join("\n\n");
}

export const handbookConnector: HandbookConnector = {
  kind: "static-markdown",
  listDocs,
  retrieve,
  getChunk,
  sectionText,
};
