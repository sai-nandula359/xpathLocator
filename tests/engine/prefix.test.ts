import { describe, expect, it } from "vitest";
import { DEFAULT_STABILITY_SETTINGS } from "@/engine/stabilityConfig";
import { generatePrefixCandidates } from "@/engine/xpath/prefix";
import { loginButtonSnapshot, makeSnapshot } from "./fixtures";

describe("generatePrefixCandidates", () => {
  it("builds a starts-with(@id, ...) candidate for a framework-generated id with a stable prefix", () => {
    const snapshot = makeSnapshot({
      tag: "div",
      attributes: { id: "tabs-:rm:-mobile-booking-widget-modal-tabpanel-0" },
    });
    const candidates = generatePrefixCandidates(snapshot, DEFAULT_STABILITY_SETTINGS);
    const idCandidate = candidates.find((c) => c.attributeName === "id");
    expect(idCandidate?.value).toBe("//div[starts-with(@id, 'tabs')]");
    expect(idCandidate?.type).toBe("xpath-attribute");
    expect(idCandidate?.usesDynamicAttribute).toBe(false);
  });

  it("builds a starts-with candidate for a configured test-id attribute too", () => {
    const snapshot = makeSnapshot({
      tag: "button",
      attributes: { "data-testid": "search-widget-99213" },
    });
    const candidates = generatePrefixCandidates(snapshot, DEFAULT_STABILITY_SETTINGS);
    const testIdCandidate = candidates.find((c) => c.attributeName === "data-testid");
    expect(testIdCandidate?.value).toBe("//button[starts-with(@data-testid, 'search-widget')]");
  });

  it("only anchors on the first class token, since starts-with only checks the start of @class", () => {
    const snapshot = makeSnapshot({
      tag: "div",
      classList: ["css-a1b2c3d4e5", "stable-widget"],
      attributes: { class: "css-a1b2c3d4e5 stable-widget" },
    });
    const candidates = generatePrefixCandidates(snapshot, DEFAULT_STABILITY_SETTINGS);
    // "css-a1b2c3d4e5" is a whole-value hash-like token (no stable literal chunk of its own), and
    // the second token is never considered since it isn't first — so no class candidate at all.
    expect(candidates.some((c) => c.attributeName === "class")).toBe(false);
  });

  it("does not generate a candidate for an already-stable id — the plain equality candidate elsewhere is strictly better", () => {
    const candidates = generatePrefixCandidates(loginButtonSnapshot(), DEFAULT_STABILITY_SETTINGS);
    expect(candidates).toEqual([]);
  });

  it("does not generate a candidate when the id is dynamic end-to-end with nothing stable to anchor on", () => {
    const snapshot = makeSnapshot({ tag: "div", attributes: { id: "f47ac10b-58cc-4372-a567-0e02b2c3d479" } });
    const candidates = generatePrefixCandidates(snapshot, DEFAULT_STABILITY_SETTINGS);
    expect(candidates.some((c) => c.attributeName === "id")).toBe(false);
  });
});
