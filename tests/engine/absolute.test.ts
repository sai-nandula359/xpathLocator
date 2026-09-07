import { describe, expect, it } from "vitest";
import { generateAbsolute } from "@/engine/xpath/absolute";
import { loginButtonSnapshot, makeSnapshot } from "./fixtures";

describe("generateAbsolute", () => {
  it("builds a full path from the ancestor chain, omitting the index on <html>", () => {
    const [candidate] = generateAbsolute(loginButtonSnapshot());
    expect(candidate.type).toBe("xpath-absolute");
    expect(candidate.value).toBe("/html/body[1]/div[2]/form[1]/div[1]/button[1]");
  });

  it("returns nothing when there is no ancestor chain", () => {
    expect(generateAbsolute(makeSnapshot({ ancestorChain: [] }))).toEqual([]);
  });

  it("is never flagged as using a dynamic attribute", () => {
    const [candidate] = generateAbsolute(loginButtonSnapshot());
    expect(candidate.usesDynamicAttribute).toBe(false);
  });
});
