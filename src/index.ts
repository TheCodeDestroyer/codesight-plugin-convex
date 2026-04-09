import { join } from "node:path";
import { discoverConvexDirs } from "./discover.js";
import { DEFAULT_FUNCTION_PATTERNS, parseRoutes, type RouteResult } from "./route-parser.js";
import { parseSchemas, type SchemaResult } from "./schema-parser.js";
import type { ConvexPluginOptions, ConvexProjectOptions, FunctionPattern } from "./types.js";

export { DEFAULT_FUNCTION_PATTERNS } from "./route-parser.js";
export type { ConvexPluginOptions, ConvexProjectOptions, FunctionPattern } from "./types.js";

interface ResolvedOptions {
  prefix?: string;
  routeDirs: string[];
  schemaDirs: string[];
  extraFunctionPatterns: FunctionPattern[];
  authPatterns: RegExp[];
  metadataMarkers: Record<string, { name: string; type: string; flags: string[] }[]>;
  ignoreDirs: string[];
}

function mergeOptions(
  base: ConvexPluginOptions,
  override: ConvexProjectOptions = {},
): ResolvedOptions {
  return {
    prefix: override.prefix ?? base.prefix,
    routeDirs: override.routeDirs ?? base.routeDirs ?? ["route", "action"],
    schemaDirs: override.schemaDirs ?? base.schemaDirs ?? ["schema"],
    extraFunctionPatterns: override.extraFunctionPatterns ?? base.extraFunctionPatterns ?? [],
    authPatterns: override.authPatterns ?? base.authPatterns ?? [/hasAccess/],
    metadataMarkers: override.metadataMarkers ?? base.metadataMarkers ?? {},
    ignoreDirs: override.ignoreDirs ?? base.ignoreDirs ?? [],
  };
}

function scanConvexProject(convexDir: string, projectRoot: string, opts: ResolvedOptions) {
  const allPatterns: FunctionPattern[] = [
    ...DEFAULT_FUNCTION_PATTERNS,
    ...opts.extraFunctionPatterns,
  ];
  const convexRoot = join(projectRoot, convexDir);
  const tag = opts.prefix;

  const routes = opts.routeDirs.flatMap((dir) => {
    const fullDir = join(convexRoot, dir);
    const pathPrefix = `${convexDir}/${dir}/`;
    return parseRoutes(
      fullDir,
      projectRoot,
      pathPrefix,
      allPatterns,
      opts.authPatterns,
      opts.ignoreDirs,
    );
  });

  // Collect schema paths: subdirectories + schema.ts at convex root
  const schemaPaths = [
    ...opts.schemaDirs.map((dir) => join(convexRoot, dir)),
    join(convexRoot, "schema.ts"),
  ];
  const schemas = parseSchemas(schemaPaths, opts.metadataMarkers, opts.ignoreDirs);

  if (tag) {
    for (const r of routes) r.path = `${tag}:${r.path}`;
    for (const s of schemas) s.name = `${tag}:${s.name}`;
  }

  return { routes, schemas };
}

/**
 * Create a Codesight plugin for Convex backends.
 *
 * @example
 * // Minimal — auto-discovers all convex/ dirs
 * import { convexPlugin } from 'codesight-plugin-convex';
 * export default { plugins: [convexPlugin()] };
 *
 * @example
 * // Single project (non-monorepo)
 * convexPlugin({ convexDir: 'convex' })
 *
 * @example
 * // Monorepo with per-project overrides
 * convexPlugin({
 *   authPatterns: [/hasAccess/],
 *   projects: {
 *     'apps/web/convex': { extraFunctionPatterns: [{ pattern: 'zAdminMutation', method: 'MUTATION', tags: ['admin'] }] },
 *     'apps/api/convex': {},  // uses defaults
 *   },
 * })
 */
export function convexPlugin(options: ConvexPluginOptions = {}) {
  const { convexDir = "convex", projects, autoDiscover = true } = options;

  return {
    name: "convex",
    detector: async (_files: string[], project: { root: string }) => {
      const root = project.root;
      let convexDirs: string[];

      if (projects) {
        // Explicit project mapping
        convexDirs = Object.keys(projects);
      } else if (autoDiscover) {
        // Auto-discover all convex/ directories
        convexDirs = discoverConvexDirs(root);
        // Fall back to convexDir option if nothing found
        if (convexDirs.length === 0) convexDirs = [convexDir];
      } else {
        convexDirs = [convexDir];
      }

      const allRoutes: RouteResult[] = [];
      const allSchemas: SchemaResult[] = [];

      for (const dir of convexDirs) {
        const projectOpts = mergeOptions(options, projects?.[dir]);
        const result = scanConvexProject(dir, root, projectOpts);
        allRoutes.push(...result.routes);
        allSchemas.push(...result.schemas);
      }

      return { routes: allRoutes, schemas: allSchemas };
    },
  };
}
