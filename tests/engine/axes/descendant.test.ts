import { describe, expect, it } from "vitest";
import { generateDescendantAxis } from "@/engine/xpath/axes/descendant";
import { DEFAULT_STABILITY_SETTINGS } from "@/engine/stabilityConfig";
import { loginFormDescendantSnapshot, makeSnapshot } from "../fixtures";

describe("generateDescendantAxis", () => {
  it("matches the doc's own example exactly: form/descendant::input[@name='username']", () => {
    const [candidate] = generateDescendantAxis(loginFormDescendantSnapshot(), DEFAULT_STABILITY_SETTINGS);
    expect(candidate.value).toBe("//form[@id='loginForm']/descendant::input[@name='username']");
    expect(candidate.axis).toBe("descendant");
    expect(candidate.attributeName).toBe("name");
  });

  it("also emits the // shorthand SelectorsHub-style form, same axis tag", () => {
    const [, shorthand] = generateDescendantAxis(loginFormDescendantSnapshot(), DEFAULT_STABILITY_SETTINGS);
    expect(shorthand.value).toBe("//form[@id='loginForm']//input[@name='username']");
    expect(shorthand.axis).toBe("descendant");
    expect(shorthand.attributeName).toBe("name");
  });

  it("works at any landmark depth, unlike child::", () => {
    const snapshot = loginFormDescendantSnapshot();
    snapshot.landmarkAncestor!.depth = 4;
    expect(generateDescendantAxis(snapshot, DEFAULT_STABILITY_SETTINGS)).toHaveLength(2);
  });

  it("produces nothing without a landmark ancestor", () => {
    expect(generateDescendantAxis(makeSnapshot(), DEFAULT_STABILITY_SETTINGS)).toEqual([]);
  });

  it("produces nothing when the landmark isn't page-unique", () => {
    const snapshot = loginFormDescendantSnapshot();
    snapshot.landmarkAncestor!.element = { ...snapshot.landmarkAncestor!.element, isUnique: false };
    expect(generateDescendantAxis(snapshot, DEFAULT_STABILITY_SETTINGS)).toEqual([]);
  });
});
