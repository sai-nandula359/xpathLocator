import { describe, expect, it } from "vitest";
import { generateFollowingPrecedingAxis } from "@/engine/xpath/axes/followingPreceding";
import { DEFAULT_STABILITY_SETTINGS } from "@/engine/stabilityConfig";
import { makeSnapshot, usernameInputSnapshot } from "../fixtures";

describe("generateFollowingPrecedingAxis", () => {
  it("matches the doc's own example: label/following::input[1]", () => {
    const [candidate] = generateFollowingPrecedingAxis(usernameInputSnapshot(), DEFAULT_STABILITY_SETTINGS);
    expect(candidate.value).toBe("//label[normalize-space()='Username']/following::input[1]");
    expect(candidate.axis).toBe("following");
  });

  it("still generates alongside parent:: for the same shared-parent field (doc lists both)", () => {
    const snapshot = usernameInputSnapshot();
    expect(snapshot.labelAnchor!.sharesParent).toBe(true);
    expect(generateFollowingPrecedingAxis(snapshot, DEFAULT_STABILITY_SETTINGS)).toHaveLength(1);
  });

  it("uses preceding:: when the label comes after the target in document order", () => {
    const snapshot = usernameInputSnapshot();
    snapshot.labelAnchor!.documentOrder = "after";
    const [candidate] = generateFollowingPrecedingAxis(snapshot, DEFAULT_STABILITY_SETTINGS);
    expect(candidate.value).toBe("//label[normalize-space()='Username']/preceding::input[1]");
    expect(candidate.axis).toBe("preceding");
  });

  it("produces nothing without a label anchor", () => {
    expect(generateFollowingPrecedingAxis(makeSnapshot(), DEFAULT_STABILITY_SETTINGS)).toEqual([]);
  });

  it("produces nothing when the label isn't page-unique — this is the case that used to silently produce a multi-match locator", () => {
    const snapshot = usernameInputSnapshot();
    snapshot.labelAnchor!.element = { ...snapshot.labelAnchor!.element, isUnique: false };
    expect(generateFollowingPrecedingAxis(snapshot, DEFAULT_STABILITY_SETTINGS)).toEqual([]);
  });
});
