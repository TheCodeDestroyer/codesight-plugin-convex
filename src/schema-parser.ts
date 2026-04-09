import { statSync } from "node:fs";
import { extractBalanced, readFile, walkDir } from "./utils.js";

export interface SchemaResult {
  name: string;
  fields: { name: string; type: string; flags: string[] }[];
  relations: string[];
  orm: "unknown";
  confidence: "regex";
}

function parseConvexType(raw: string): string {
  const t = raw.trim();
  if (t.startsWith("v.optional("))
    return `optional<${parseConvexType(extractBalanced(t, t.indexOf("(")))}>`;
  if (t.startsWith("v.array("))
    return `array<${parseConvexType(extractBalanced(t, t.indexOf("(")))}>`;
  const idMatch = t.match(/^v\.id\(['"](\w+)['"]\)$/);
  if (idMatch) return `id<${idMatch[1]}>`;
  if (t.startsWith("v.object(")) return "object";
  if (t.startsWith("v.union(")) return "union";
  if (t.startsWith("v.literal(")) return "literal";
  const simple = t.match(/^v\.(\w+)\(\)$/);
  if (simple) return simple[1]!;
  if (t.startsWith("zodToConvex(")) return "enum";
  return t;
}

function parseFields(block: string) {
  const fields: { name: string; type: string; flags: string[] }[] = [];
  const re = /(\w+)\s*:\s*(v\.\w+\(|zodToConvex\()/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(block)) !== null) {
    const fieldName = match[1]!;
    const exprStart = match.index + match[0].length - match[2]!.length;
    const parenStart = exprStart + match[2]!.length - 1;
    const inner = extractBalanced(block, parenStart);
    const fullExpr = `${block.slice(exprStart, parenStart)}(${inner})`;
    const type = parseConvexType(fullExpr);
    const flags: string[] = [];
    if (fullExpr.includes("v.id(")) flags.push("fk");
    if (fullExpr.includes("v.optional(")) flags.push("nullable");
    fields.push({ name: fieldName, type, flags });
  }
  return fields;
}

/**
 * Collect .ts files from a path — if it's a file, return just that;
 * if it's a directory, walk it recursively.
 */
function collectFiles(path: string, ignoreDirs: string[]): string[] {
  try {
    const stat = statSync(path);
    if (stat.isFile() && path.endsWith(".ts") && !path.endsWith(".d.ts")) return [path];
    if (stat.isDirectory()) return walkDir(path, ignoreDirs);
  } catch {
    // doesn't exist
  }
  return [];
}

export function parseSchemas(
  schemaPaths: string[],
  metadataMarkers: Record<string, { name: string; type: string; flags: string[] }[]>,
  ignoreDirs: string[],
): SchemaResult[] {
  const schemas: SchemaResult[] = [];
  const files = schemaPaths.flatMap((p) => collectFiles(p, ignoreDirs));

  for (const file of files) {
    const content = readFile(file);
    const tableRegex = /(?:export\s+)?const\s+(\w+)\s*=\s*defineTable\(\{/g;
    let tableMatch: RegExpExecArray | null;
    while ((tableMatch = tableRegex.exec(content)) !== null) {
      const tableName = tableMatch[1]!;
      const braceStart = content.indexOf("{", tableMatch.index + tableMatch[0].length - 1);
      const fieldsBlock = extractBalanced(content, braceStart, "{", "}");
      const fields = parseFields(fieldsBlock);

      // Inject metadata marker fields
      for (const [marker, extraFields] of Object.entries(metadataMarkers)) {
        if (fieldsBlock.includes(marker)) {
          fields.push(...extraFields);
        }
      }

      const afterTable = content.slice(braceStart + fieldsBlock.length + 2);
      const indexMatches = [...afterTable.matchAll(/\.index\(['"](\w+)['"]/g)];
      const relations = indexMatches.map((m) => `index:${m[1]}`);

      const cleanName = tableName
        .replace(/Table$/, "")
        .replace(/([a-z])([A-Z])/g, "$1_$2")
        .toLowerCase();

      schemas.push({
        name: cleanName,
        fields,
        relations,
        orm: "unknown",
        confidence: "regex",
      });
    }
  }
  return schemas;
}
