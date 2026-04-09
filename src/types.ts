export interface FunctionPattern {
  /** Regex source string to match exported Convex functions */
  pattern: string;
  /** What kind of Convex operation this maps to */
  method: "QUERY" | "MUTATION" | "ACTION" | "HTTP";
  /** Tags to apply when matched (e.g. 'public', 'internal') */
  tags?: string[];
}

export interface ConvexProjectOptions {
  /** Prefix for route paths and schema names (e.g. 'my-app' -> 'my-app:route.path'). Useful in monorepos to distinguish apps. */
  prefix?: string;
  /** Directories containing route/function files, relative to the Convex root (default: ['route', 'action']) */
  routeDirs?: string[];
  /** Directories containing schema files, relative to the Convex root (default: ['schema']) */
  schemaDirs?: string[];
  /** Additional function patterns beyond the built-in ones */
  extraFunctionPatterns?: FunctionPattern[];
  /** Regex patterns that indicate auth-protected routes (default: [/hasAccess/]) */
  authPatterns?: RegExp[];
  /** Field spread markers that inject metadata fields (e.g. '...metadataFields' -> adds updatedAt) */
  metadataMarkers?: Record<string, { name: string; type: string; flags: string[] }[]>;
  /** Directories/patterns to skip inside the Convex root */
  ignoreDirs?: string[];
}

export interface ConvexPluginOptions extends ConvexProjectOptions {
  /** Root Convex directory name, relative to project root (default: 'convex') */
  convexDir?: string;
  /**
   * Per-project overrides for monorepos.
   * Key is the path to the convex dir relative to project root (e.g. 'apps/my-app/convex').
   * Values override the top-level defaults for that project.
   */
  projects?: Record<string, ConvexProjectOptions>;
  /**
   * Auto-discover convex/ directories in the project tree (default: true).
   * When true and no `projects` are specified, walks the project to find all convex/ dirs.
   */
  autoDiscover?: boolean;
}
