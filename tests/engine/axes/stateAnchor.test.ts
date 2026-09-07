import { describe, expect, it } from "vitest";
import { generateStateAnchorAxis } from "@/engine/xpath/axes/stateAnchor";
import { DEFAULT_STABILITY_SETTINGS } from "@/engine/stabilityConfig";
import { makeSnapshot, tabbedWidgetStateAnchorSnapshot } from "../fixtures";
import type { StateAnchor } from "@/types";

describe("generateStateAnchorAxis", () => {
  it("combines the anchor's own predicate with the live-verified state predicate via 'and'", () => {
    const [candidate] = generateStateAnchorAxis(tabbedWidgetStateAnchorSnapshot(), DEFAULT_STABILITY_SETTINGS);
    expect(candidate.value).toBe("//div[@role='tabpanel' and not(@hidden)]//input[@id='location']");
    expect(candidate.type).toBe("xpath-axis");
    expect(candidate.axis).toBe("descendant");
    expect(candidate.attributeName).toBe("id");
  });

  it("produces nothing without a state anchor", () => {
    expect(generateStateAnchorAxis(makeSnapshot(), DEFAULT_STABILITY_SETTINGS)).toEqual([]);
  });

  it("does NOT require the anchor element itself to be unique — that's the whole point", () => {
    const snapshot = tabbedWidgetStateAnchorSnapshot();
    expect(snapshot.stateAnchor!.element.isUnique).toBe(false);
    expect(generateStateAnchorAxis(snapshot, DEFAULT_STABILITY_SETTINGS)).toHaveLength(1);
  });

  it("supports an aria-selected style state predicate the same way", () => {
    const stateAnchor: StateAnchor = {
      element: { tag: "li", text: "", attributes: { role: "tab" }, isUnique: false },
      depth: 2,
      statePredicate: "@aria-selected='true'",
    };
    const snapshot = makeSnapshot({
      tag: "button",
      attributes: { "data-testid": "submit" },
      stateAnchor,
    });
    const [candidate] = generateStateAnchorAxis(snapshot, DEFAULT_STABILITY_SETTINGS);
    expect(candidate.value).toBe("//li[@role='tab' and @aria-selected='true']//button[@data-testid='submit']");
  });

  it("produces nothing when neither the anchor nor the target has a usable predicate", () => {
    const stateAnchor: StateAnchor = { element: { tag: "div", text: "", attributes: {}, isUnique: false }, depth: 1, statePredicate: "not(@hidden)" };
    const snapshot = makeSnapshot({ stateAnchor });
    expect(generateStateAnchorAxis(snapshot, DEFAULT_STABILITY_SETTINGS)).toEqual([]);
  });
});
