import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseSchemas } from "../src/schema-parser.js";

function withTempSchema(content: string) {
  const dir = mkdtempSync(join(tmpdir(), "schema-test-"));
  const file = join(dir, "schema.ts");
  writeFileSync(file, content);
  return { dir, file, cleanup: () => rmSync(dir, { recursive: true }) };
}

describe("parseSchemas", () => {
  test("extracts a simple defineTable", () => {
    const { file, cleanup } = withTempSchema(`
      const usersTable = defineTable({
        name: v.string(),
        email: v.string(),
        age: v.number(),
      });
    `);

    try {
      const schemas = parseSchemas([file], {}, []);
      expect(schemas).toHaveLength(1);
      expect(schemas[0].name).toBe("users");
      expect(schemas[0].fields).toEqual([
        { name: "name", type: "string", flags: [] },
        { name: "email", type: "string", flags: [] },
        { name: "age", type: "number", flags: [] },
      ]);
    } finally {
      cleanup();
    }
  });

  test("strips Table suffix and converts camelCase to snake_case", () => {
    const { file, cleanup } = withTempSchema(`
      const userProfileTable = defineTable({
        bio: v.string(),
      });
    `);

    try {
      const schemas = parseSchemas([file], {}, []);
      expect(schemas[0].name).toBe("user_profile");
    } finally {
      cleanup();
    }
  });

  test("handles v.optional and v.id types", () => {
    const { file, cleanup } = withTempSchema(`
      const postsTable = defineTable({
        title: v.string(),
        authorId: v.id("users"),
        subtitle: v.optional(v.string()),
      });
    `);

    try {
      const schemas = parseSchemas([file], {}, []);
      expect(schemas[0].fields).toEqual([
        { name: "title", type: "string", flags: [] },
        { name: "authorId", type: "id<users>", flags: ["fk"] },
        { name: "subtitle", type: "optional<string>", flags: ["nullable"] },
      ]);
    } finally {
      cleanup();
    }
  });

  test("detects indexes as relations", () => {
    const { file, cleanup } = withTempSchema(`
      const postsTable = defineTable({
        title: v.string(),
      })
        .index("by_author", ["authorId"])
        .index("by_date", ["createdAt"]);
    `);

    try {
      const schemas = parseSchemas([file], {}, []);
      expect(schemas[0].relations).toEqual(["index:by_author", "index:by_date"]);
    } finally {
      cleanup();
    }
  });

  test("handles v.array type", () => {
    const { file, cleanup } = withTempSchema(`
      const tagsTable = defineTable({
        items: v.array(v.string()),
      });
    `);

    try {
      const schemas = parseSchemas([file], {}, []);
      expect(schemas[0].fields[0].type).toBe("array<string>");
    } finally {
      cleanup();
    }
  });

  test("injects metadata marker fields", () => {
    const { file, cleanup } = withTempSchema(`
      const usersTable = defineTable({
        name: v.string(),
        ...metadataFields,
      });
    `);

    const markers = {
      "...metadataFields": [{ name: "updatedAt", type: "number", flags: ["auto"] }],
    };

    try {
      const schemas = parseSchemas([file], markers, []);
      const fieldNames = schemas[0].fields.map((f: { name: string }) => f.name);
      expect(fieldNames).toContain("name");
      expect(fieldNames).toContain("updatedAt");
    } finally {
      cleanup();
    }
  });

  test("handles multiple tables in one file", () => {
    const { file, cleanup } = withTempSchema(`
      const usersTable = defineTable({
        name: v.string(),
      });
      const postsTable = defineTable({
        title: v.string(),
      });
    `);

    try {
      const schemas = parseSchemas([file], {}, []);
      expect(schemas).toHaveLength(2);
      expect(schemas[0].name).toBe("users");
      expect(schemas[1].name).toBe("posts");
    } finally {
      cleanup();
    }
  });

  test("extracts inline schema syntax (key: defineTable)", () => {
    const { file, cleanup } = withTempSchema(`
      const schema = defineSchema({
        users: defineTable({
          name: v.string(),
          email: v.string(),
        }),
        posts: defineTable({
          title: v.string(),
        }),
      });
    `);

    try {
      const schemas = parseSchemas([file], {}, []);
      expect(schemas).toHaveLength(2);
      expect(schemas[0].name).toBe("users");
      expect(schemas[0].fields).toHaveLength(2);
      expect(schemas[1].name).toBe("posts");
    } finally {
      cleanup();
    }
  });

  test("detects searchIndex as relation", () => {
    const { file, cleanup } = withTempSchema(`
      const postsTable = defineTable({
        title: v.string(),
        body: v.string(),
      })
        .index("by_author", ["authorId"])
        .searchIndex("search_body", { searchField: "body" });
    `);

    try {
      const schemas = parseSchemas([file], {}, []);
      expect(schemas[0].relations).toEqual(["index:by_author", "index:search_body"]);
    } finally {
      cleanup();
    }
  });

  test("detects indexes through inline comments", () => {
    const { file, cleanup } = withTempSchema(`
      const postsTable = defineTable({
        title: v.string(),
      })
        // index docs
        .index("by_author", ["authorId"])
        // search index for full-text
        .searchIndex("search_body", { searchField: "body" });
    `);

    try {
      const schemas = parseSchemas([file], {}, []);
      expect(schemas[0].relations).toEqual(["index:by_author", "index:search_body"]);
    } finally {
      cleanup();
    }
  });

  test("does not bleed indexes across multiple tables", () => {
    const { file, cleanup } = withTempSchema(`
      const usersTable = defineTable({
        name: v.string(),
      });
      const postsTable = defineTable({
        title: v.string(),
      })
        .index("by_author", ["authorId"]);
    `);

    try {
      const schemas = parseSchemas([file], {}, []);
      expect(schemas[0].name).toBe("users");
      expect(schemas[0].relations).toEqual([]);
      expect(schemas[1].name).toBe("posts");
      expect(schemas[1].relations).toEqual(["index:by_author"]);
    } finally {
      cleanup();
    }
  });

  test("scans a directory of schema files", () => {
    const dir = mkdtempSync(join(tmpdir(), "schema-dir-test-"));
    writeFileSync(join(dir, "users.ts"), `const usersTable = defineTable({ name: v.string() });`);
    writeFileSync(join(dir, "posts.ts"), `const postsTable = defineTable({ title: v.string() });`);

    try {
      const schemas = parseSchemas([dir], {}, []);
      expect(schemas).toHaveLength(2);
      const names = schemas.map((s) => s.name).sort();
      expect(names).toEqual(["posts", "users"]);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
