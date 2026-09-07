import { describe, expect, it } from "vitest";
import { generateParentAxis } from "@/engine/xpath/axes/parent";
import { DEFAULT_STABILITY_SETTINGS } from "@/engine/stabilityConfig";
import { makeSnapshot, usernameInputSnapshot } from "../fixtures";

describe("generateParentAxis", () => {
  it("matches the doc's own example: label/parent::div//input", () => {
    const [candidate] = generateParentAxis(usernameInputSnapshot(), DEFAULT_STABILITY_SETTINGS);
    expect(candidate.value).toBe("//label[normalize-space()='Username']/parent::div//input");
    expect(candidate.type).toBe("xpath-axis");
    expect(candidate.axis).toBe("parent");
  });

  it("produces nothing without a label anchor whose parent contains the target", () => {
    expect(generateParentAxis(makeSnapshot(), DEFAULT_STABILITY_SETTINGS)).toEqual([]);
  });

  it("produces nothing when the label isn't page-unique (e.g. repeated across table rows)", () => {
    const snapshot = usernameInputSnapshot();
    snapshot.labelAnchor!.element = { ...snapshot.labelAnchor!.element, isUnique: false };
    expect(generateParentAxis(snapshot, DEFAULT_STABILITY_SETTINGS)).toEqual([]);
  });

  it("falls back to * for the parent tag when parentTag is unknown", () => {
    const snapshot = usernameInputSnapshot();
    snapshot.parentTag = null;
    const [candidate] = generateParentAxis(snapshot, DEFAULT_STABILITY_SETTINGS);
    expect(candidate.value).toContain("/parent::*//input");
  });
});
