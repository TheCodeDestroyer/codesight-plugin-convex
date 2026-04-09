# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Codesight plugin for Convex backends. Detects and extracts routes (queries, mutations, actions) and schemas (defineTable) from Convex project directories, outputting them in Codesight's standardized format.

## Commands

- `bun run build` — compile TypeScript to `dist/` (runs `tsc`)
- `bun test` — run tests (bun test runner, tests in `tests/`)
- `bun run lint` — lint + format check via Biome
- `bun run format` — auto-fix lint + format via Biome

## Architecture

Single-export plugin (`convexPlugin()` in `src/index.ts`) that returns a Codesight detector object with `{ name, detector }`.

**Flow:** `convexPlugin()` → discovers convex dirs → scans each project → merges routes + schemas

- `src/index.ts` — Plugin entry point, option merging, orchestrates scanning per convex dir
- `src/discover.ts` — Filesystem walker that finds all `convex/` directories (monorepo support)
- `src/route-parser.ts` — Regex-based extraction of exported Convex functions (`query`, `mutation`, `action`, zod wrappers). Builds route paths from file paths + export names
- `src/schema-parser.ts` — Extracts `defineTable({...})` blocks, parses `v.*` type expressions into simplified type strings, resolves indexes as relations
- `src/utils.ts` — Shared fs helpers: `walkDir`, `readFile`, `extractBalanced` (paren matching)
- `src/types.ts` — `ConvexPluginOptions`, `ConvexProjectOptions`, `FunctionPattern` interfaces

## Key Conventions

- ESM-only (`"type": "module"`), all local imports use `.js` extension
- Regex-based parsing (not AST) — patterns match `export const X = fnType(` syntax
- Peer dependency on `codesight >=1.9.0`; types come from codesight's `RouteResult`-like shape
- Schema names are derived by stripping `Table` suffix and converting camelCase to snake_case
- Route paths use dot notation: `dirName.fileName.exportName`
- See `/convex:patterns` skill for Convex-specific patterns when modifying parsers
