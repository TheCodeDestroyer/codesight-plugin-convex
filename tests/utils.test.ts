import { describe, expect, test } from "bun:test";
import { extractBalanced } from "../src/utils.js";

describe("extractBalanced", () => {
  test("extracts content between matching parens", () => {
    const result = extractBalanced("fn(a, b)", 2);
    expect(result).toBe("a, b");
  });

  test("handles nested parens", () => {
    const result = extractBalanced("fn(a(b, c), d)", 2);
    expect(result).toBe("a(b, c), d");
  });

  test("handles deeply nested parens", () => {
    const result = extractBalanced("fn(a(b(c)))", 2);
    expect(result).toBe("a(b(c))");
  });

  test("returns rest of string when unbalanced", () => {
    const result = extractBalanced("fn(a, b", 2);
    expect(result).toBe("a, b");
  });

  test("handles empty parens", () => {
    const result = extractBalanced("fn()", 2);
    expect(result).toBe("");
  });

  test("starts from correct position", () => {
    const result = extractBalanced("foo(x) bar(y, z)", 10);
    expect(result).toBe("y, z");
  });
});
