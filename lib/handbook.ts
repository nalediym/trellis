/**
 * Loads the synthetic teacher handbook from the repo's `handbook/` directory
 * at module-init time. The chunks are held in memory and re-used per request
 * — no database required (this is a demo).
 *
 * The chunker is intentionally dumb: we split on `#` / `##` headings, same as
 * the Python original.
 */
import fs from "node:fs";
import path from "node:path";

export interface Chunk {
  path: string;
  heading: string;
  text: string;
  score?: number;
}

function loadChunks(): Chunk[] {
  // process.cwd() points at the project root in Next.js server runtime.
  const dir = path.join(process.cwd(), "handbook");
  if (!fs.existsSync(dir)) return [];

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort();

  const chunks: Chunk[] = [];
  for (const fileName of files) {
    const full = path.join(dir, fileName);
    const raw = fs.readFileSync(full, "utf-8");
    const lines = raw.split(/\r?\n/);

    let currentHeading = fileName.replace(/\.md$/, "");
    let buf: string[] = [];

    const flush = () => {
      const text = buf.join("\n").trim();
      if (text) {
        chunks.push({ path: fileName, heading: currentHeading, text });
      }
      buf = [];
    };

    for (const line of lines) {
      if (line.startsWith("# ") || line.startsWith("## ")) {
        flush();
        currentHeading = line.replace(/^#+\s+/, "").trim();
      } else {
        buf.push(line);
      }
    }
    flush();
  }
  return chunks;
}

// Cache the parsed chunks across requests in the same lambda instance.
let cached: Chunk[] | null = null;
export function getHandbookChunks(): Chunk[] {
  if (!cached) cached = loadChunks();
  return cached;
}
