import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { SKIP_DIRS } from "./utils.js";

/**
 * Find all `convex/` directories under root, returning paths relative to root.
 * Stops descending once a convex/ dir is found (no nested convex/ dirs).
 */
export function discoverConvexDirs(root: string, maxDepth = 5): string[] {
  const results: string[] = [];
  walk(root, root, 0, maxDepth, results);
  return results;
}

function walk(dir: string, root: string, depth: number, maxDepth: number, results: string[]) {
  if (depth > maxDepth) return;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.name === "convex") {
        results.push(relative(root, full));
      } else {
        walk(full, root, depth + 1, maxDepth, results);
      }
    }
  } catch {
    // permission denied or doesn't exist
  }
}
