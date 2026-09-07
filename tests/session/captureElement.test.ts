// First unit test in session/ — exercises captureElement.ts's full orchestration (generate ->
// validate -> score -> classify -> indexed-disambiguation fallback -> name) against a real jsdom
// document, using a fake ElectronWebviewElement whose executeJavaScript runs the generated
// scripts against `document` the same way tests/engine/validator.test.ts does for the scripts in
// isolation. This is the case none of those lower-level tests can exercise on their own: several
// genuinely *visible* duplicate elements, where nothing but indexed disambiguation can resolve a
// unique locator.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { captureElement } from "@/session/captureElement";
import { DEFAULT_STABILITY_SETTINGS } from "@/engine/stabilityConfig";
import { makeSnapshot } from "../engine/fixtures";
import type { CaptureSession, StateAnchor } from "@/types";

let originalGetBoundingClientRect: typeof Element.prototype.getBoundingClientRect;

beforeEach(() => {
  originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
  // All elements in these fixtures are meant to read as visible — real layout isn't available
  // in jsdom, so stand in a nonzero rect for every element (mirrors validator.test.ts's mockRects).
  Element.prototype.getBoundingClientRect = function () {
    return { width: 100, height: 20, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} } as DOMRect;
  };
});

afterEach(() => {
  Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  document.body.innerHTML = "";
});

function fakeWebview(): ElectronWebviewElement {
  return {
    executeJavaScript: async (script: string) => new Function(`return ${script}`)(),
  } as unknown as ElectronWebviewElement;
}

function emptySession(): CaptureSession {
  return {
    id: "s1",
    name: "Session",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    baseUrl: "https://example.com/list",
    currentUrl: "https://example.com/list",
    elements: [],
  };
}

describe("captureElement", () => {
  it("falls back to an (xpath)[N] indexed candidate, and it becomes Primary, when three visible duplicates share every other signal", async () => {
    document.body.innerHTML = `
      <div class="row">Duplicate</div>
      <div class="row">Duplicate</div>
      <div class="row">Duplicate</div>
    `;

    // The 2nd of three identical, unlabeled div.row siblings — no id/name/data-testid/aria-label
    // distinguishes it from the other two, so every attribute- and text-keyed candidate this
    // generates resolves to 3 visible matches. Only the ancestor-chain-derived xpath-absolute
    // (and its CSS equivalent) is unique on its own, and both are excluded from "did anything
    // already resolve this" per captureElement.ts's tryBuildIndexedCandidate.
    const snapshot = makeSnapshot({
      tag: "div",
      text: "Duplicate",
      innerText: "Duplicate",
      outerHtml: `<div class="row">Duplicate</div>`,
      attributes: { class: "row" },
      classList: ["row"],
      parentTag: "body",
      siblingIndex: 1,
      siblingCount: 3,
      ancestorChain: [
        { tag: "html", index: 1 },
        { tag: "body", index: 1 },
        { tag: "div", index: 2 },
      ],
    });

    const { element } = await captureElement(fakeWebview(), snapshot, emptySession(), DEFAULT_STABILITY_SETTINGS);

    const indexed = element.candidates.find((c) => c.type === "xpath-indexed");
    expect(indexed).toBeDefined();
    expect(indexed!.value).toContain(")[2]");
    expect(indexed!.validation?.unique).toBe(true);

    const primary = element.candidates.find((c) => c.id === element.primaryLocatorId);
    expect(primary?.type).toBe("xpath-indexed");

    // The non-unique xpath-class/css/text candidates generated for these identical siblings
    // must never reach the panel — only locators that actually resolve to exactly one live
    // element belong in the output.
    expect(element.candidates.every((c) => c.validation?.unique)).toBe(true);
  });

  it("regression: a shared id matching 4 DOM elements (only 1 visible) is never Primary and never marked unique, even though it's the only visible match", async () => {
    // Mirrors a real site hit during manual testing: a "location search" input whose id is
    // duplicated across 4 DOM elements (a broken/templated widget), with only 1 of them actually
    // rendered. The old visibility-aware uniqueness heuristic treated that as safe to recommend
    // (1 visible match) and made it Primary — but Playwright's strict mode throws on a 4-element
    // resolution regardless of visibility, and Selenium silently grabs whichever is first. This
    // locks in the fix: uniqueness must be judged on the real DOM match count.
    document.body.innerHTML = `
      <input id="location" />
      <input id="location" />
      <input id="location" />
      <input id="location" />
    `;
    const inputs = document.querySelectorAll("#location");
    Element.prototype.getBoundingClientRect = function (this: Element) {
      const visible = this === inputs[1]; // only the 2nd of the 4 is actually rendered
      return {
        width: visible ? 100 : 0,
        height: visible ? 20 : 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON() {},
      } as DOMRect;
    };

    const snapshot = makeSnapshot({
      tag: "input",
      outerHtml: `<input id="location" />`,
      attributes: { id: "location" },
      parentTag: "body",
      ancestorChain: [
        { tag: "html", index: 1 },
        { tag: "body", index: 1 },
        { tag: "input", index: 2 },
      ],
    });

    const { element } = await captureElement(fakeWebview(), snapshot, emptySession(), DEFAULT_STABILITY_SETTINGS);

    // The id-keyed candidate (matches all 4) must be filtered out of the result entirely, not
    // just deprioritized — it never validates unique, so it has no place in the panel.
    expect(element.candidates.some((c) => c.type === "xpath-id")).toBe(false);
    expect(element.candidates.find((c) => c.id === element.primaryLocatorId)?.type).not.toBe("xpath-id");

    // Every surviving candidate must be a genuine, single-DOM-match locator — proven directly
    // against matchCount, not just the `unique` boolean, so a future regression in how `unique`
    // is derived can't slip this test through vacuously.
    expect(element.candidates.length).toBeGreaterThan(0);
    for (const candidate of element.candidates) {
      expect(candidate.validation?.matchCount).toBe(1);
      expect(candidate.validation?.unique).toBe(true);
    }
  });

  it("prefers a state-anchored axis candidate over indexed disambiguation when a hidden/visible-panel convention distinguishes the duplicates", async () => {
    // A real production case one level up: a search widget duplicated once per tab, each copy
    // wrapped in a div[role='tabpanel'] — only the active tab's panel lacks the `hidden`
    // attribute. Indexed disambiguation ((expr)[N]) would work but breaks the moment tabs get
    // reordered or a new one is added; an axis anchored on the *state* that actually marks the
    // active panel survives that. This proves the state-anchor axis wins the slot instead.
    document.body.innerHTML = `
      <div role="tabpanel" hidden><input id="location" /></div>
      <div role="tabpanel"><input id="location" /></div>
      <div role="tabpanel" hidden><input id="location" /></div>
      <div role="tabpanel" hidden><input id="location" /></div>
    `;

    const stateAnchor: StateAnchor = {
      element: { tag: "div", text: "", attributes: { role: "tabpanel" }, isUnique: false },
      depth: 1,
      statePredicate: "not(@hidden)",
    };
    const snapshot = makeSnapshot({
      tag: "input",
      outerHtml: `<input id="location" />`,
      attributes: { id: "location" },
      parentTag: "div",
      stateAnchor,
      ancestorChain: [
        { tag: "html", index: 1 },
        { tag: "body", index: 1 },
        { tag: "div", index: 2 },
        { tag: "input", index: 1 },
      ],
    });

    const { element } = await captureElement(fakeWebview(), snapshot, emptySession(), DEFAULT_STABILITY_SETTINGS);

    expect(element.candidates.some((c) => c.type === "xpath-indexed")).toBe(false);

    const stateAnchored = element.candidates.find((c) => c.value.includes("not(@hidden)"));
    expect(stateAnchored).toBeDefined();
    expect(stateAnchored!.value).toBe("//div[@role='tabpanel' and not(@hidden)]//input[@id='location']");
    expect(stateAnchored!.validation?.unique).toBe(true);
    expect(stateAnchored!.validation?.matchCount).toBe(1);

    const primary = element.candidates.find((c) => c.id === element.primaryLocatorId);
    expect(primary?.value).toBe(stateAnchored!.value);
  });

  it("drops every non-unique candidate from the result, keeping only ones that validate unique", async () => {
    document.body.innerHTML = `
      <button class="btn">Duplicate</button>
      <button class="btn">Duplicate</button>
    `;

    const snapshot = makeSnapshot({
      tag: "button",
      text: "Duplicate",
      innerText: "Duplicate",
      outerHtml: `<button class="btn">Duplicate</button>`,
      attributes: { class: "btn" },
      classList: ["btn"],
      parentTag: "body",
      ancestorChain: [
        { tag: "html", index: 1 },
        { tag: "body", index: 1 },
        { tag: "button", index: 1 },
      ],
    });

    const { element } = await captureElement(fakeWebview(), snapshot, emptySession(), DEFAULT_STABILITY_SETTINGS);

    for (const candidate of element.candidates) {
      expect(candidate.validation?.unique).toBe(true);
    }
  });

  it("falls back to the full candidate list rather than leaving zero locators when nothing can validate unique at all", async () => {
    // No ancestor chain at all (e.g. a cross-origin iframe/closed shadow root limited-context
    // capture) means no xpath-absolute/positional-css candidate exists to fall back on, and both
    // duplicate buttons still validate non-unique — captureElement must not filter the element
    // down to zero locators just because none of them are safe to recommend.
    document.body.innerHTML = `
      <button class="btn">Duplicate</button>
      <button class="btn">Duplicate</button>
    `;

    const snapshot = makeSnapshot({
      tag: "button",
      text: "Duplicate",
      innerText: "Duplicate",
      outerHtml: `<button class="btn">Duplicate</button>`,
      attributes: { class: "btn" },
      classList: ["btn"],
      parentTag: "body",
      ancestorChain: [],
    });

    const { element } = await captureElement(fakeWebview(), snapshot, emptySession(), DEFAULT_STABILITY_SETTINGS);

    expect(element.candidates.length).toBeGreaterThan(0);
    expect(element.candidates.every((c) => c.validation?.unique === false)).toBe(true);
  });

  it("does not add an indexed candidate when a real attribute already validates unique", async () => {
    document.body.innerHTML = `<button id="loginButton" data-testid="login-button">Login</button>`;

    const snapshot = makeSnapshot({
      tag: "button",
      text: "Login",
      innerText: "Login",
      outerHtml: `<button id="loginButton" data-testid="login-button">Login</button>`,
      attributes: { id: "loginButton", "data-testid": "login-button" },
      ancestorChain: [
        { tag: "html", index: 1 },
        { tag: "body", index: 1 },
        { tag: "button", index: 1 },
      ],
    });

    const { element } = await captureElement(fakeWebview(), snapshot, emptySession(), DEFAULT_STABILITY_SETTINGS);

    expect(element.candidates.some((c) => c.type === "xpath-indexed")).toBe(false);
  });
});
