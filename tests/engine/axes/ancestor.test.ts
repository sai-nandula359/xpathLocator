import { describe, expect, it } from "vitest";
import { generateAncestorAxis } from "@/engine/xpath/axes/ancestor";
import { DEFAULT_STABILITY_SETTINGS } from "@/engine/stabilityConfig";
import { ancestorExampleSnapshot, makeSnapshot, usernameInputSnapshot } from "../fixtures";

describe("generateAncestorAxis", () => {
  it("matches the doc's own example: span/ancestor::div[contains(@class,'form-group')]//input", () => {
    const [candidate] = generateAncestorAxis(ancestorExampleSnapshot(), DEFAULT_STABILITY_SETTINGS);
    expect(candidate.value).toBe(
      "//span[normalize-space()='Username']/ancestor::div[contains(@class, 'form-group')]//input",
    );
    expect(candidate.axis).toBe("ancestor");
  });

  it("produces nothing without both a label anchor and a landmark ancestor", () => {
    expect(generateAncestorAxis(makeSnapshot(), DEFAULT_STABILITY_SETTINGS)).toEqual([]);
    const labelOnly = usernameInputSnapshot();
    labelOnly.landmarkAncestor = null;
    expect(generateAncestorAxis(labelOnly, DEFAULT_STABILITY_SETTINGS)).toEqual([]);
  });

  it("produces nothing when the label anchor isn't page-unique", () => {
    const snapshot = ancestorExampleSnapshot();
    snapshot.labelAnchor!.element = { ...snapshot.labelAnchor!.element, isUnique: false };
    expect(generateAncestorAxis(snapshot, DEFAULT_STABILITY_SETTINGS)).toEqual([]);
  });

  it("produces nothing when the landmark ancestor isn't page-unique", () => {
    const snapshot = ancestorExampleSnapshot();
    snapshot.landmarkAncestor!.element = { ...snapshot.landmarkAncestor!.element, isUnique: false };
    expect(generateAncestorAxis(snapshot, DEFAULT_STABILITY_SETTINGS)).toEqual([]);
  });
});
