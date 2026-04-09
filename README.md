# codesight-plugin-convex

[Codesight](https://github.com/Houseofmvps/codesight) plugin for [Convex](https://convex.dev) backends. Detects and extracts routes (queries, mutations, actions) and schemas (`defineTable`) from Convex project directories.

## Install

```bash
npm install codesight-plugin-convex
# or
pnpm add codesight-plugin-convex
# or
bun add codesight-plugin-convex
```

> Requires `codesight >= 1.9.0` as a peer dependency.

## Usage

Add the plugin to your Codesight config:

```ts
import { convexPlugin } from "codesight-plugin-convex";

export default {
  plugins: [convexPlugin()],
};
```

By default the plugin auto-discovers all `convex/` directories in your project tree (monorepo-friendly).

### Options

```ts
convexPlugin({
  // Root convex directory name (default: "convex")
  convexDir: "convex",

  // Directories containing route/function files, relative to convex root
  routeDirs: ["route", "action"],

  // Directories containing schema files, relative to convex root
  schemaDirs: ["schema"],

  // Regex patterns that indicate auth-protected routes
  authPatterns: [/hasAccess/],

  // Additional function patterns beyond built-in ones
  extraFunctionPatterns: [
    { pattern: "zAdminMutation", method: "MUTATION", tags: ["admin"] },
  ],

  // Auto-discover convex/ directories (default: true)
  autoDiscover: true,
});
```

### Monorepo support

Use `projects` to provide per-project overrides:

```ts
convexPlugin({
  authPatterns: [/hasAccess/],
  projects: {
    "apps/web/convex": {
      prefix: "web",
      extraFunctionPatterns: [
        { pattern: "zAdminMutation", method: "MUTATION", tags: ["admin"] },
      ],
    },
    "apps/api/convex": { prefix: "api" },
  },
});
```

## What it detects

### Routes

Exported Convex functions matching these patterns:

- **Vanilla:** `query`, `mutation`, `action`, `internalQuery`, `internalMutation`, `internalAction`, `httpAction`
- **Zod wrappers:** `zQuery`, `zMutation`, `zPublicQuery`, `zPublicMutation`, `zInternalQuery`, `zInternalMutation`

Route paths use dot notation derived from file paths: `convex/route/admin/users.ts` exporting `list` becomes `admin.users.list`.

### Schemas

`defineTable({...})` blocks are parsed to extract:

- Field names and types (`v.string()`, `v.id("users")`, `v.optional(v.number())`, etc.)
- Foreign key references (`v.id()` fields)
- Nullable fields (`v.optional()`)
- Index definitions as relations
- Metadata marker field injection

Table names are derived by stripping the `Table` suffix and converting camelCase to snake_case (`userProfileTable` becomes `user_profile`).

## Development

```bash
bun install          # install dependencies
bun run build        # compile TypeScript to dist/
bun test             # run tests
bun run lint         # lint + format check via Biome
bun run format       # auto-fix lint + format via Biome
```

## License

MIT
