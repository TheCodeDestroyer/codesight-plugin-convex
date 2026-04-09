import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".turbo",
  "dist",
  "build",
  ".output",
  "_generated",
]);

export function walkDir(dir: string, ignoreDirs: string[] = []): string[] {
  const ignore = new Set([...SKIP_DIRS, ...ignoreDirs]);
  const results: string[] = [];
  walkDirInner(dir, ignore, results);
  return results;
}

function walkDirInner(dir: string, ignore: Set<string>, results: string[]) {
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && !ignore.has(entry.name)) {
        walkDirInner(full, ignore, results);
      } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
        results.push(full);
      }
    }
  } catch {
    // dir doesn't exist — that's fine
  }
}

export function readFile(path: string): string {
  return readFileSync(path, "utf-8");
}

export function extractBalanced(text: string, from: number, open = "(", close = ")"): string {
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close) {
      depth--;
      if (depth === 0) return text.slice(from + 1, i);
    }
  }
  return text.slice(from + 1);
}
