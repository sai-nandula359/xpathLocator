// section 34 — Locator Repair. Exercises repairElement.ts against a real jsdom document, using
// the same fake ElectronWebviewElement pattern captureElement.test.ts uses (executeJavaScript
// just runs the generated script against `document`), so the whole re-validate/re-score/
// re-classify pipeline actually runs rather than being mocked.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { repairElement } from "@/session/repairLocator";
import type { CapturedElement, LocatorCandidate, ValidationResult } from "@/types";
import { makeSnapshot } from "../engine/fixtures";

let originalGetBoundingClientRect: typeof Element.prototype.getBoundingClientRect;

beforeEach(() => {
  originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
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

const ZERO_SCORE = {
  uniqueness: 0,
  attributeStability: 0,
  domDependency: 0,
  readability: 0,
  length: 0,
  dynamicRisk: 0,
  total: 0,
};

// Represents how the candidate validated back when the element was captured — deliberately
// stale; repairElement must re-check the live DOM rather than trusting this.
const STALE_UNIQUE: ValidationResult = {
  valid: true,
  matchCount: 1,
  visibleMatchCount: 1,
  unique: true,
  executionTimeMs: 1,
  checkedAt: "2020-01-01T00:00:00.000Z",
};

function candidate(overrides: Partial<LocatorCandidate>): LocatorCandidate {
  return {
    id: "c",
    type: "xpath-class",
    value: "//div",
    usesDynamicAttribute: false,
    score: { ...ZERO_SCORE },
    classification: "fallback",
    validation: STALE_UNIQUE,
    ...overrides,
  };
}

function makeElement(candidates: LocatorCandidate[], primaryLocatorId: string): CapturedElement {
  return {
    id: "el1",
    name: "Login Button",
    snapshot: makeSnapshot({ tag: "button" }),
    candidates,
    primaryLocatorId,
    capturedAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
    version: 1,
  };
}

describe("repairElement", () => {
  it("matches the doc's own worked example: a @class locator degrading to 4 matches gets replaced by a still-unique @data-testid one", async () => {
    document.body.innerHTML = `
      <button class="btn btn-primary">A</button>
      <button class="btn btn-primary">B</button>
      <button class="btn btn-primary" data-testid="login-button">C</button>
      <button class="btn btn-primary">D</button>
    `;
    const classCandidate = candidate({
      id: "class-based",
      type: "xpath-class",
      value: "//button[contains(@class, 'btn-primary')]",
      attributeName: "class",
    });
    const testIdCandidate = candidate({
      id: "testid-based",
      type: "xpath-attribute",
      value: "//*[@data-testid='login-button']",
      attributeName: "data-testid",
    });
    const element = makeElement([classCandidate, testIdCandidate], "class-based");

    const outcome = await repairElement(fakeWebview(), element);

    expect(outcome.repaired).toBe(true);
    expect(outcome.unrepairable).toBe(false);
    expect(outcome.previousPrimary?.validation).toMatchObject({ matchCount: 4, unique: false });
    expect(outcome.newPrimary?.id).toBe("testid-based");
    expect(outcome.newPrimary?.validation).toMatchObject({ matchCount: 1, unique: true });
  });

  it("reports no repair needed when the current Primary is still valid and unique", async () => {
    document.body.innerHTML = `<button id="loginButton">Login</button>`;
    const idCandidate = candidate({ id: "id-based", type: "xpath-id", value: "//button[@id='loginButton']", attributeName: "id" });
    const element = makeElement([idCandidate], "id-based");

    const outcome = await repairElement(fakeWebview(), element);

    expect(outcome.repaired).toBe(false);
    expect(outcome.unrepairable).toBe(false);
    expect(outcome.newPrimary?.id).toBe("id-based");
  });

  it("reports unrepairable when nothing among the stored candidates is unique anymore", async () => {
    document.body.innerHTML = `
      <button class="btn">A</button>
      <button class="btn">B</button>
    `;
    const idCandidate = candidate({ id: "id-based", type: "xpath-id", value: "//button[@id='loginButton']", attributeName: "id" });
    const classCandidate = candidate({ id: "class-based", type: "xpath-class", value: "//button[contains(@class, 'btn')]", attributeName: "class" });
    const element = makeElement([idCandidate, classCandidate], "id-based");

    const outcome = await repairElement(fakeWebview(), element);

    expect(outcome.repaired).toBe(false);
    expect(outcome.unrepairable).toBe(true);
    expect(outcome.newPrimary?.validation?.unique).toBeFalsy();
  });
});
