import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildIndexScript, buildValidationScript, toValidationResult } from "@/engine/validator";
import type { LocatorCandidate } from "@/types";

const ZERO_SCORE = {
  uniqueness: 0,
  attributeStability: 0,
  domDependency: 0,
  readability: 0,
  length: 0,
  dynamicRisk: 0,
  total: 0,
};

function candidate(type: LocatorCandidate["type"], value: string): LocatorCandidate {
  return { id: "c1", type, value, usesDynamicAttribute: false, score: { ...ZERO_SCORE }, classification: "fallback" };
}

// jsdom doesn't implement real layout, so getBoundingClientRect() always returns an all-zero
// rect by default — every element would look "hidden" to __slcsIsVisible regardless of this
// module's own logic. These tests stand in a real rect per element (by id) so the visibility
// filtering itself can actually be exercised here, the same way it runs for real against a live
// webview page.
let originalGetBoundingClientRect: typeof Element.prototype.getBoundingClientRect;

function mockRects(rectsById: Record<string, { width: number; height: number }>) {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const size = rectsById[this.id] ?? { width: 100, height: 20 };
    return { width: size.width, height: size.height, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} } as DOMRect;
  };
}

// jsdom's contentDocument has no <body> yet right after insertion (only a real navigation —
// which jsdom doesn't perform for a fake src like these tests use — creates one), so
// document.write() is used instead of the more obvious .body.innerHTML assignment.
function writeIntoFrame(frame: HTMLIFrameElement, html: string) {
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
}

beforeEach(() => {
  originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
});

afterEach(() => {
  Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  document.body.innerHTML = "";
});

describe("buildValidationScript", () => {
  it("builds a querySelectorAll-based script for CSS candidates, executable against a real DOM", () => {
    mockRects({});
    document.body.innerHTML = `<button id="a">1</button><button id="b">2</button>`;
    const script = buildValidationScript(candidate("css", "button"));
    // eslint-disable-next-line no-eval
    const result = new Function(`return ${script}`)();
    expect(result).toEqual({ valid: true, matchCount: 2, visibleMatchCount: 2 });
  });

  it("only counts visible matches in visibleMatchCount, but still reports the raw total in matchCount", () => {
    mockRects({ visible: { width: 100, height: 20 }, hidden: { width: 0, height: 0 } });
    document.body.innerHTML = `<input id="visible" name="location" /><input id="hidden" name="location" />`;
    const script = buildValidationScript(candidate("css", "[name='location']"));
    // eslint-disable-next-line no-eval
    const result = new Function(`return ${script}`)();
    expect(result).toEqual({ valid: true, matchCount: 2, visibleMatchCount: 1 });
  });

  it("reports an invalid CSS selector instead of throwing", () => {
    const script = buildValidationScript(candidate("css", ":::not-a-selector"));
    const result = new Function(`return ${script}`)();
    expect(result.valid).toBe(false);
    expect(result.matchCount).toBe(0);
    expect(result.visibleMatchCount).toBe(0);
    expect(result.error).toBeTruthy();
  });

  it("builds a document.evaluate-based script for XPath candidates", () => {
    const script = buildValidationScript(candidate("xpath-id", "//button[@id='loginButton']"));
    // Evaluates against the resolved root-document variable, not a literal "document" — see the
    // "frame-aware" describe block below for why: it needs to be able to resolve to an <iframe>'s
    // own document instead of the top one when the candidate came from inside a frame.
    expect(script).toContain(".evaluate(");
    expect(script).toContain("XPathResult.ORDERED_NODE_SNAPSHOT_TYPE");
    expect(script).toContain(JSON.stringify("//button[@id='loginButton']"));
  });

  it("XPath candidates also filter by visibility the same way CSS ones do", () => {
    mockRects({ visible: { width: 50, height: 50 }, hidden: { width: 0, height: 0 } });
    document.body.innerHTML = `<div id="visible" class="row"></div><div id="hidden" class="row"></div>`;
    const script = buildValidationScript(candidate("xpath-class", "//div[contains(@class, 'row')]"));
    // eslint-disable-next-line no-eval
    const result = new Function(`return ${script}`)();
    expect(result).toEqual({ valid: true, matchCount: 2, visibleMatchCount: 1 });
  });

  describe("frame-aware queries (frameSrc)", () => {
    // Regression coverage for a real bug: webview.executeJavaScript() only ever runs against the
    // webview's *top* document, so a candidate captured inside a same-origin <iframe> validated
    // against the wrong document entirely — every locator reported 0 matches and read as
    // "non-unique" even when it was, in fact, the single correct match inside the frame.

    it("queries inside the matching iframe's own document, not the top one, when frameSrc is given", () => {
      document.body.innerHTML = `<button id="outer-button"></button><iframe src="child.html"></iframe>`;
      const frame = document.querySelector("iframe") as HTMLIFrameElement;
      writeIntoFrame(frame, `<button id="target"></button>`);

      const cssScript = buildValidationScript(candidate("css", "#target"), "child.html");
      // eslint-disable-next-line no-eval
      const cssResult = new Function(`return ${cssScript}`)();
      expect(cssResult.matchCount).toBe(1);

      // The same id genuinely does not exist in the top document — proves this isn't accidentally
      // matching there instead.
      const outerScript = buildValidationScript(candidate("css", "#target"), null);
      // eslint-disable-next-line no-eval
      expect(new Function(`return ${outerScript}`)().matchCount).toBe(0);
    });

    it("resolves XPath candidates inside the frame the same way CSS ones are", () => {
      document.body.innerHTML = `<iframe src="child.html"></iframe>`;
      const frame = document.querySelector("iframe") as HTMLIFrameElement;
      writeIntoFrame(frame, `<input id="target" name="target" />`);

      const script = buildValidationScript(candidate("xpath-id", "//input[@id='target']"), "child.html");
      // eslint-disable-next-line no-eval
      const result = new Function(`return ${script}`)();
      expect(result.matchCount).toBe(1);
    });

    it("falls back to the top document instead of throwing when the named frame can't be found", () => {
      document.body.innerHTML = `<button id="target"></button>`; // no iframe present at all
      const script = buildValidationScript(candidate("css", "#target"), "missing-frame.html");
      // eslint-disable-next-line no-eval
      const result = new Function(`return ${script}`)();
      expect(result).toEqual({ valid: true, matchCount: 1, visibleMatchCount: 0 });
    });
  });
});

describe("buildIndexScript", () => {
  it("finds the 1-based position of the ground-truth element among three identical matches", () => {
    document.body.innerHTML = `
      <div class="row" id="r1"></div>
      <div class="row" id="r2"></div>
      <div class="row" id="r3"></div>
    `;
    const script = buildIndexScript(candidate("xpath-class", "//div[@class='row']"), "//div[@id='r2']");
    // eslint-disable-next-line no-eval
    const result = new Function(`return ${script}`)();
    expect(result).toEqual({ found: true, index: 2 });
  });

  it("finds the position for each of several identical matches, not just one", () => {
    document.body.innerHTML = `
      <div class="row" id="r1"></div>
      <div class="row" id="r2"></div>
      <div class="row" id="r3"></div>
    `;
    const candidateExpr = candidate("xpath-class", "//div[@class='row']");
    expect(new Function(`return ${buildIndexScript(candidateExpr, "//div[@id='r1']")}`)()).toEqual({
      found: true,
      index: 1,
    });
    expect(new Function(`return ${buildIndexScript(candidateExpr, "//div[@id='r3']")}`)()).toEqual({
      found: true,
      index: 3,
    });
  });

  it("reports not found when the ground-truth element doesn't exist", () => {
    document.body.innerHTML = `<div class="row" id="r1"></div>`;
    const script = buildIndexScript(candidate("xpath-class", "//div[@class='row']"), "//div[@id='missing']");
    // eslint-disable-next-line no-eval
    const result = new Function(`return ${script}`)();
    expect(result.found).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("reports not found when the ground-truth element isn't among the candidate's matches", () => {
    document.body.innerHTML = `<div class="row" id="r1"></div><span id="s1"></span>`;
    const script = buildIndexScript(candidate("xpath-class", "//div[@class='row']"), "//span[@id='s1']");
    // eslint-disable-next-line no-eval
    const result = new Function(`return ${script}`)();
    expect(result).toEqual({ found: false, index: 0 });
  });

  it("also supports CSS candidates via querySelectorAll", () => {
    document.body.innerHTML = `
      <div class="row" id="r1"></div>
      <div class="row" id="r2"></div>
    `;
    const script = buildIndexScript(candidate("css", ".row"), "//div[@id='r2']");
    // eslint-disable-next-line no-eval
    const result = new Function(`return ${script}`)();
    expect(result).toEqual({ found: true, index: 2 });
  });

  it("resolves both the ground truth and the candidate's matches inside the named frame, not the top document", () => {
    document.body.innerHTML = `<iframe src="child.html"></iframe>`;
    const frame = document.querySelector("iframe") as HTMLIFrameElement;
    writeIntoFrame(
      frame,
      `
      <div class="row" id="r1"></div>
      <div class="row" id="r2"></div>
      <div class="row" id="r3"></div>
    `,
    );

    const script = buildIndexScript(
      candidate("xpath-class", "//div[@class='row']"),
      "//div[@id='r2']",
      "child.html",
    );
    // eslint-disable-next-line no-eval
    const result = new Function(`return ${script}`)();
    expect(result).toEqual({ found: true, index: 2 });
  });
});

describe("toValidationResult", () => {
  it("derives uniqueness from valid && matchCount === 1", () => {
    expect(toValidationResult({ valid: true, matchCount: 1, visibleMatchCount: 1 }, 5).unique).toBe(true);
    expect(toValidationResult({ valid: true, matchCount: 2, visibleMatchCount: 2 }, 5).unique).toBe(false);
    expect(toValidationResult({ valid: false, matchCount: 1, visibleMatchCount: 1 }, 5).unique).toBe(false);
  });

  // Playwright's strict mode throws ("resolved to 4 elements") on exactly this shape regardless
  // of visibility, and Selenium's find_element silently grabs whichever match happens to be
  // first — so a locator matching several real DOM elements is never safe to recommend just
  // because only one of them is currently rendered.
  it("does not treat hidden duplicates as unique — several DOM matches stays non-unique even with only 1 visible", () => {
    const result = toValidationResult({ valid: true, matchCount: 4, visibleMatchCount: 1 }, 5);
    expect(result.unique).toBe(false);
    expect(result.matchCount).toBe(4);
    expect(result.visibleMatchCount).toBe(1);
  });

  it("treats several *visible* matches as non-unique too", () => {
    expect(toValidationResult({ valid: true, matchCount: 4, visibleMatchCount: 4 }, 5).unique).toBe(false);
  });

  it("still treats a single DOM match as unique even when it isn't currently visible (e.g. mid-animation)", () => {
    expect(toValidationResult({ valid: true, matchCount: 1, visibleMatchCount: 0 }, 5).unique).toBe(true);
    expect(toValidationResult({ valid: true, matchCount: 3, visibleMatchCount: 0 }, 5).unique).toBe(false);
  });

  it("carries the execution time and error through", () => {
    const result = toValidationResult({ valid: false, matchCount: 0, visibleMatchCount: 0, error: "boom" }, 12);
    expect(result.executionTimeMs).toBe(12);
    expect(result.error).toBe("boom");
  });
});
