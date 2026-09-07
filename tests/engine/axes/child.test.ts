import { describe, expect, it } from "vitest";
import { generateChildAxis } from "@/engine/xpath/axes/child";
import { DEFAULT_STABILITY_SETTINGS } from "@/engine/stabilityConfig";
import { loginFormDescendantSnapshot, makeSnapshot } from "../fixtures";

describe("generateChildAxis", () => {
  it("extends the doc's example with a final step down to the real target", () => {
    // The doc's own example (//form[@id='loginForm']/child::div[1]) stops at the intermediate
    // div; a candidate that doesn't resolve to the captured element itself would validate
    // against the wrong node, so this generator always finishes with one more step.
    const [candidate] = generateChildAxis(loginFormDescendantSnapshot(), DEFAULT_STABILITY_SETTINGS);
    expect(candidate.value).toBe("//form[@id='loginForm']/child::div[1]/input[1]");
    expect(candidate.axis).toBe("child");
  });

  it("requires the landmark to be exactly the target's grandparent (depth 1)", () => {
    const snapshot = loginFormDescendantSnapshot();
    snapshot.landmarkAncestor!.depth = 2;
    expect(generateChildAxis(snapshot, DEFAULT_STABILITY_SETTINGS)).toEqual([]);
  });

  it("produces nothing without a landmark ancestor", () => {
    expect(generateChildAxis(makeSnapshot(), DEFAULT_STABILITY_SETTINGS)).toEqual([]);
  });

  it("produces nothing when the landmark isn't page-unique", () => {
    const snapshot = loginFormDescendantSnapshot();
    snapshot.landmarkAncestor!.element = { ...snapshot.landmarkAncestor!.element, isUnique: false };
    expect(generateChildAxis(snapshot, DEFAULT_STABILITY_SETTINGS)).toEqual([]);
  });
});
