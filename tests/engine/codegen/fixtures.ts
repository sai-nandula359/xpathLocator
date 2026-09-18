import { loginButtonSnapshot, makeSnapshot, usernameInputSnapshot } from "../fixtures";
import type { CapturedElement, LocatorCandidate, ValidationResult } from "@/types";

const ZERO_SCORE = {
  uniqueness: 0,
  attributeStability: 0,
  domDependency: 0,
  readability: 0,
  length: 0,
  dynamicRisk: 0,
  total: 0,
};

export function uniqueValidation(matchCount = 1): ValidationResult {
  return {
    valid: true,
    matchCount,
    visibleMatchCount: matchCount,
    unique: matchCount === 1,
    executionTimeMs: 1,
    checkedAt: new Date(0).toISOString(),
  };
}

let counter = 0;
export function makeCandidate(overrides: Partial<LocatorCandidate> = {}): LocatorCandidate {
  counter += 1;
  return {
    id: `cand-${counter}`,
    type: "xpath-attribute",
    value: "//div",
    usesDynamicAttribute: false,
    score: { ...ZERO_SCORE },
    classification: "fallback",
    validation: uniqueValidation(),
    ...overrides,
  };
}

export function makeCapturedElement(
  name: string,
  snapshot: CapturedElement["snapshot"],
  candidates: LocatorCandidate[],
): CapturedElement {
  const primary = candidates[0] ?? null;
  return {
    id: "el-1",
    name,
    snapshot,
    candidates,
    primaryLocatorId: primary?.id ?? null,
    capturedAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    version: 1,
  };
}

// The doc's own worked example (sections 12/14/20/23/24/25/28's Login Button): id="loginButton",
// data-testid="login-button", visible text "Login" — exercised so codegen output can be checked
// directly against the doc's literal examples (By.id("loginButton"), getByTestId('login-button'), ...).
export function loginButtonElement(): CapturedElement {
  const snapshot = loginButtonSnapshot();
  const idCandidate = makeCandidate({
    id: "cand-id",
    type: "xpath-id",
    value: "//button[@id='loginButton']",
    attributeName: "id",
  });
  const testIdCandidate = makeCandidate({
    id: "cand-testid",
    type: "xpath-attribute",
    value: "//button[@data-testid='login-button']",
    attributeName: "data-testid",
  });
  const cssCandidate = makeCandidate({ id: "cand-css", type: "css", value: "#loginButton" });
  return makeCapturedElement("Login Submit Button", snapshot, [testIdCandidate, idCandidate, cssCandidate]);
}

// The doc's Username field example: name="username", placeholder="Username", no id/data-testid —
// forces every generator down to its next-best (non-testid, non-id) strategy.
export function usernameInputElement(): CapturedElement {
  const snapshot = usernameInputSnapshot();
  const nameCandidate = makeCandidate({
    id: "cand-name",
    type: "xpath-name",
    value: "//input[@name='username']",
    attributeName: "name",
  });
  const cssCandidate = makeCandidate({ id: "cand-css", type: "css", value: "input[name='username']" });
  return makeCapturedElement("Username Input", snapshot, [nameCandidate, cssCandidate]);
}

// An <a> with visible text and no id/name/data-testid/single class — forces Selenium's strategy
// picker down to Link Text (section 21), sourced from a live-validated engine/xpath/linkText.ts
// candidate rather than snapshot text alone.
export function navLinkElement(candidates?: LocatorCandidate[]): CapturedElement {
  const snapshot = makeSnapshot({
    tag: "a",
    text: "Learn More",
    innerText: "Learn More",
    attributes: { href: "/learn-more" },
  });
  const resolved = candidates ?? [
    makeCandidate({ id: "cand-linktext", type: "xpath-linktext", value: "//a[text()='Learn More']" }),
  ];
  return makeCapturedElement("Learn More Link", snapshot, resolved);
}
