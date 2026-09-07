import { describe, expect, it } from "vitest";
import { generateCandidates } from "@/engine/generate";
import { loginButtonSnapshot, makeSnapshot, usernameInputSnapshot } from "./fixtures";

describe("generateCandidates", () => {
  it("produces candidates across every category for a rich element", () => {
    const candidates = generateCandidates(loginButtonSnapshot());
    const types = new Set(candidates.map((c) => c.type));
    expect(types).toContain("xpath-id");
    expect(types).toContain("xpath-class");
    expect(types).toContain("xpath-attribute");
    expect(types).toContain("xpath-combination");
    expect(types).toContain("xpath-text");
    expect(types).toContain("xpath-absolute");
    expect(types).toContain("css");
  });

  it("assigns every candidate a unique id", () => {
    const candidates = generateCandidates(loginButtonSnapshot());
    const ids = new Set(candidates.map((c) => c.id));
    expect(ids.size).toBe(candidates.length);
  });

  it("de-duplicates identical (type, value) pairs across generators", () => {
    const candidates = generateCandidates(loginButtonSnapshot());
    const keys = candidates.map((c) => `${c.type}::${c.value}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("degrades gracefully for a bare element with almost no identifying attributes", () => {
    const candidates = generateCandidates(makeSnapshot({ tag: "div" }));
    // Still gets an absolute XPath at minimum — never an empty candidate list.
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.some((c) => c.type === "xpath-absolute")).toBe(true);
  });

  it("includes axis candidates when anchor/landmark context is present", () => {
    const candidates = generateCandidates(usernameInputSnapshot());
    const axes = candidates.filter((c) => c.type === "xpath-axis").map((c) => c.axis);
    expect(axes).toContain("parent");
    expect(axes).toContain("following");
    expect(axes).toContain("following-sibling");
    expect(axes).toContain("descendant");
  });

  it("produces no axis candidates for a plain element with no label/landmark context", () => {
    const candidates = generateCandidates(loginButtonSnapshot());
    // loginButtonSnapshot has an id, so self:: is the one axis expected to appear.
    const axes = candidates.filter((c) => c.type === "xpath-axis").map((c) => c.axis);
    expect(axes).toEqual(["self"]);
  });
});
