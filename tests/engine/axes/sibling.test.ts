import { describe, expect, it } from "vitest";
import { generateSiblingAxis } from "@/engine/xpath/axes/sibling";
import { DEFAULT_STABILITY_SETTINGS } from "@/engine/stabilityConfig";
import { makeSnapshot, usernameInputSnapshot } from "../fixtures";

describe("generateSiblingAxis", () => {
  it("matches the doc's own example: label/following-sibling::input", () => {
    const candidates = generateSiblingAxis(usernameInputSnapshot(), DEFAULT_STABILITY_SETTINGS);
    expect(candidates.map((c) => c.value)).toContain(
      "//label[normalize-space()='Username']/following-sibling::input",
    );
    expect(candidates.every((c) => c.axis === "following-sibling")).toBe(true);
  });

  it("reaches the target *forward* from a previous-sibling anchor (following-sibling::), not backward", () => {
    const snapshot = makeSnapshot({
      tag: "input",
      siblingAnchors: { previous: { tag: "span", text: "hint", attributes: {}, isUnique: true }, next: null },
    });
    const [candidate] = generateSiblingAxis(snapshot, DEFAULT_STABILITY_SETTINGS);
    expect(candidate.value).toBe("//span[normalize-space()='hint']/following-sibling::input");
  });

  it("reaches the target *backward* from a next-sibling anchor (preceding-sibling::)", () => {
    const snapshot = makeSnapshot({
      tag: "input",
      siblingAnchors: { previous: null, next: { tag: "span", text: "hint", attributes: {}, isUnique: true } },
    });
    const [candidate] = generateSiblingAxis(snapshot, DEFAULT_STABILITY_SETTINGS);
    expect(candidate.value).toBe("//span[normalize-space()='hint']/preceding-sibling::input");
  });

  it("produces nothing when the sibling anchor is not page-unique", () => {
    const snapshot = makeSnapshot({
      tag: "input",
      siblingAnchors: { previous: { tag: "span", text: "hint", attributes: {}, isUnique: false }, next: null },
    });
    expect(generateSiblingAxis(snapshot, DEFAULT_STABILITY_SETTINGS)).toEqual([]);
  });

  it("uses preceding-sibling:: when a shared-parent label comes after the target", () => {
    const snapshot = usernameInputSnapshot();
    snapshot.labelAnchor!.documentOrder = "after";
    const candidates = generateSiblingAxis(snapshot, DEFAULT_STABILITY_SETTINGS);
    expect(candidates.some((c) => c.axis === "preceding-sibling")).toBe(true);
  });

  it("produces nothing when there's no shared-parent label and no sibling anchors", () => {
    expect(generateSiblingAxis(makeSnapshot(), DEFAULT_STABILITY_SETTINGS)).toEqual([]);
  });
});
