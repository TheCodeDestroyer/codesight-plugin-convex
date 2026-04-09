import { relative } from "node:path";
import type { FunctionPattern } from "./types.js";
import { readFile, walkDir } from "./utils.js";

export interface RouteResult {
  method: string;
  path: string;
  file: string;
  tags: string[];
  framework: "raw-http";
  confidence: "regex";
}

/** Built-in Convex function patterns */
export const DEFAULT_FUNCTION_PATTERNS: FunctionPattern[] = [
  // Vanilla Convex
  { pattern: "query", method: "QUERY" },
  { pattern: "mutation", method: "MUTATION" },
  { pattern: "action", method: "ACTION" },
  { pattern: "internalQuery", method: "QUERY", tags: ["internal"] },
  { pattern: "internalMutation", method: "MUTATION", tags: ["internal"] },
  { pattern: "internalAction", method: "ACTION", tags: ["internal"] },
  { pattern: "httpAction", method: "HTTP", tags: ["public"] },
  // convex-helpers zod wrappers
  { pattern: "zQuery", method: "QUERY" },
  { pattern: "zMutation", method: "MUTATION" },
  { pattern: "zPublicQuery", method: "QUERY", tags: ["public"] },
  { pattern: "zPublicMutation", method: "MUTATION", tags: ["public"] },
  { pattern: "zInternalQuery", method: "QUERY", tags: ["internal"] },
  { pattern: "zInternalMutation", method: "MUTATION", tags: ["internal"] },
];

function buildRouteRegex(patterns: FunctionPattern[]): RegExp {
  const names = patterns.map((p) => p.pattern).join("|");
  return new RegExp(`export\\s+const\\s+(\\w+)\\s*=\\s*(${names})\\s*\\(`, "g");
}

function buildMethodMap(patterns: FunctionPattern[]): Map<string, FunctionPattern> {
  return new Map(patterns.map((p) => [p.pattern, p]));
}

export function parseRoutes(
  dir: string,
  projectRoot: string,
  pathPrefix: string,
  patterns: FunctionPattern[],
  authPatterns: RegExp[],
  ignoreDirs: string[],
): RouteResult[] {
  const regex = buildRouteRegex(patterns);
  const methodMap = buildMethodMap(patterns);
  const routes: RouteResult[] = [];

  for (const file of walkDir(dir, ignoreDirs)) {
    const content = readFile(file);
    const relPath = relative(projectRoot, file);
    regex.lastIndex = 0;
    let hasAuth: boolean | undefined;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const name = match[1]!;
      const fnType = match[2]!;
      const pattern = methodMap.get(fnType);
      if (!pattern) continue;

      const routePath = `${relPath.slice(pathPrefix.length).replace(/\.ts$/, "").replace(/\//g, ".")}.${name}`;

      const tags: string[] = [...(pattern.tags ?? [])];
      hasAuth ??= authPatterns.some((re) => re.test(content));
      if (hasAuth) tags.push("auth");

      routes.push({
        method: pattern.method,
        path: routePath,
        file: relPath,
        tags,
        framework: "raw-http",
        confidence: "regex",
      });
    }
  }
  return routes;
}
