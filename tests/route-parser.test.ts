import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_FUNCTION_PATTERNS, parseRoutes } from "../src/route-parser.js";

function withTempRoutes(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "route-test-"));
  const dir = join(root, "convex", "route");
  mkdirSync(dir, { recursive: true });

  for (const [name, content] of Object.entries(files)) {
    const filePath = join(dir, name);
    mkdirSync(join(filePath, ".."), { recursive: true });
    writeFileSync(filePath, content);
  }

  return {
    dir,
    root,
    cleanup: () => rmSync(root, { recursive: true }),
  };
}

describe("parseRoutes", () => {
  test("extracts query, mutation, and action exports", () => {
    const { dir, root, cleanup } = withTempRoutes({
      "users.ts": `
        export const list = query({ handler: async (ctx) => {} });
        export const create = mutation({ handler: async (ctx) => {} });
        export const sync = action({ handler: async (ctx) => {} });
      `,
    });

    try {
      const routes = parseRoutes(dir, root, "convex/route/", DEFAULT_FUNCTION_PATTERNS, [], []);
      expect(routes).toHaveLength(3);

      const methods = routes.map((r) => r.method);
      expect(methods).toContain("QUERY");
      expect(methods).toContain("MUTATION");
      expect(methods).toContain("ACTION");

      expect(routes[0].path).toBe("users.list");
      expect(routes[1].path).toBe("users.create");
      expect(routes[2].path).toBe("users.sync");
    } finally {
      cleanup();
    }
  });

  test("detects internal functions with tags", () => {
    const { dir, root, cleanup } = withTempRoutes({
      "internal.ts": `
        export const doStuff = internalMutation({ handler: async (ctx) => {} });
      `,
    });

    try {
      const routes = parseRoutes(dir, root, "convex/route/", DEFAULT_FUNCTION_PATTERNS, [], []);
      expect(routes).toHaveLength(1);
      expect(routes[0].method).toBe("MUTATION");
      expect(routes[0].tags).toContain("internal");
    } finally {
      cleanup();
    }
  });

  test("detects zod wrapper patterns", () => {
    const { dir, root, cleanup } = withTempRoutes({
      "zod.ts": `
        export const getUser = zQuery({ handler: async (ctx) => {} });
        export const updateUser = zMutation({ handler: async (ctx) => {} });
        export const runJob = zAction({ handler: async (ctx) => {} });
      `,
    });

    try {
      const routes = parseRoutes(dir, root, "convex/route/", DEFAULT_FUNCTION_PATTERNS, [], []);
      expect(routes).toHaveLength(3);
      expect(routes[0].method).toBe("QUERY");
      expect(routes[1].method).toBe("MUTATION");
      expect(routes[2].method).toBe("ACTION");
    } finally {
      cleanup();
    }
  });

  test("detects zod internal action pattern", () => {
    const { dir, root, cleanup } = withTempRoutes({
      "internal.ts": `
        export const sync = zInternalAction({ handler: async (ctx) => {} });
      `,
    });

    try {
      const routes = parseRoutes(dir, root, "convex/route/", DEFAULT_FUNCTION_PATTERNS, [], []);
      expect(routes).toHaveLength(1);
      expect(routes[0].method).toBe("ACTION");
      expect(routes[0].tags).toContain("internal");
    } finally {
      cleanup();
    }
  });

  test("adds auth tag when auth pattern matches", () => {
    const { dir, root, cleanup } = withTempRoutes({
      "protected.ts": `
        export const secret = query({
          handler: async (ctx) => {
            const user = await hasAccess(ctx);
          },
        });
      `,
    });

    try {
      const routes = parseRoutes(
        dir,
        root,
        "convex/route/",
        DEFAULT_FUNCTION_PATTERNS,
        [/hasAccess/],
        [],
      );
      expect(routes[0].tags).toContain("auth");
    } finally {
      cleanup();
    }
  });

  test("handles nested directory structure", () => {
    const { dir, root, cleanup } = withTempRoutes({
      "admin/users.ts": `
        export const list = query({ handler: async (ctx) => {} });
      `,
    });

    try {
      const routes = parseRoutes(dir, root, "convex/route/", DEFAULT_FUNCTION_PATTERNS, [], []);
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe("admin.users.list");
    } finally {
      cleanup();
    }
  });

  test("ignores non-exported functions", () => {
    const { dir, root, cleanup } = withTempRoutes({
      "utils.ts": `
        const helper = query({ handler: async (ctx) => {} });
        function doStuff() {}
      `,
    });

    try {
      const routes = parseRoutes(dir, root, "convex/route/", DEFAULT_FUNCTION_PATTERNS, [], []);
      expect(routes).toHaveLength(0);
    } finally {
      cleanup();
    }
  });

  test("uses custom function patterns", () => {
    const customPatterns = [
      ...DEFAULT_FUNCTION_PATTERNS,
      { pattern: "adminMutation", method: "MUTATION" as const, tags: ["admin"] },
    ];

    const { dir, root, cleanup } = withTempRoutes({
      "admin.ts": `
        export const deleteUser = adminMutation({ handler: async (ctx) => {} });
      `,
    });

    try {
      const routes = parseRoutes(dir, root, "convex/route/", customPatterns, [], []);
      expect(routes).toHaveLength(1);
      expect(routes[0].method).toBe("MUTATION");
      expect(routes[0].tags).toContain("admin");
    } finally {
      cleanup();
    }
  });

  test("sets file path relative to project root", () => {
    const { dir, root, cleanup } = withTempRoutes({
      "users.ts": `export const list = query({ handler: async (ctx) => {} });`,
    });

    try {
      const routes = parseRoutes(dir, root, "convex/route/", DEFAULT_FUNCTION_PATTERNS, [], []);
      expect(routes[0].file).toBe("convex/route/users.ts");
    } finally {
      cleanup();
    }
  });
});
