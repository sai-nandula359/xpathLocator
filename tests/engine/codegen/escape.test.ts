import { describe, expect, it } from "vitest";
import { escapeDoubleQuoted, quoteJs, quotePy } from "@/engine/codegen/escape";

describe("escapeDoubleQuoted", () => {
  it("escapes backslashes and double quotes for embedding in a \"...\" literal", () => {
    expect(escapeDoubleQuoted(`He said "hi"`)).toBe(`He said \\"hi\\"`);
    expect(escapeDoubleQuoted(`a\\b`)).toBe(`a\\\\b`);
  });
});

describe("quoteJs", () => {
  it("prefers single quotes when the value has none", () => {
    expect(quoteJs("login-button")).toBe("'login-button'");
  });

  it("falls back to double quotes when the value itself contains a single quote", () => {
    expect(quoteJs("input[name='username']")).toBe(`"input[name='username']"`);
  });

  it("falls back to a template literal when the value contains both quote characters", () => {
    const result = quoteJs(`it's "quoted"`);
    expect(result).toBe("`it's \"quoted\"`");
  });
});

describe("quotePy", () => {
  it("prefers single quotes, matching quoteJs, since that's valid Python too", () => {
    expect(quotePy("login-button")).toBe("'login-button'");
  });

  it("falls back to triple-quotes when the value contains both quote characters", () => {
    expect(quotePy(`it's "quoted"`)).toBe(`'''it's "quoted"'''`);
  });
});
