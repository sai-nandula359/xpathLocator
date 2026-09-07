// Shared "which native Playwright locator fits this element" logic for all four Playwright
// targets (playwrightTs/Js/Python/Java.ts each format this same decision in their own syntax).
// section 23 — the doc explicitly wants native Playwright locators preferred over raw
// CSS/XPath: getByRole('button', { name: 'Login' }), getByTestId('login-button'),
// getByPlaceholder('Username'), locator("input[name='username']") as the fallback.

import { bestCandidateOfType, bestFallbackCandidate } from "@/engine/codegen/fallback";
import { accessibleName, inferRole } from "@/engine/codegen/role";
import { DEFAULT_TEST_ID_ATTRIBUTES } from "@/engine/stabilityConfig";
import type { CapturedElement } from "@/types";

export type PlaywrightStrategyKind = "testid" | "role" | "label" | "placeholder" | "text" | "locator";

export interface PlaywrightStrategy {
  kind: PlaywrightStrategyKind;
  testId?: string;
  role?: string;
  name?: string;
  placeholder?: string;
  text?: string;
  locatorValue?: string;
}

const MAX_TEXT_LENGTH = 60;

export function pickPlaywrightStrategy(element: CapturedElement): PlaywrightStrategy {
  const { snapshot } = element;

  const testIdCandidate = bestCandidateOfType(
    element,
    (c) => !!c.attributeName && DEFAULT_TEST_ID_ATTRIBUTES.includes(c.attributeName),
  );
  if (testIdCandidate && testIdCandidate.attributeName) {
    const testId = snapshot.attributes[testIdCandidate.attributeName];
    if (testId) return { kind: "testid", testId };
  }

  const role = inferRole(snapshot);
  const name = accessibleName(snapshot);
  if (role && name && name.length <= MAX_TEXT_LENGTH) {
    return { kind: "role", role, name };
  }

  if (snapshot.labelAnchor?.element.text) {
    return { kind: "label", name: snapshot.labelAnchor.element.text };
  }

  if (snapshot.attributes.placeholder) {
    return { kind: "placeholder", placeholder: snapshot.attributes.placeholder };
  }

  const ownText = (snapshot.text || snapshot.innerText).trim();
  if (ownText && ownText.length <= MAX_TEXT_LENGTH) {
    return { kind: "text", text: ownText };
  }

  const fallback = bestFallbackCandidate(element);
  return { kind: "locator", locatorValue: fallback?.value ?? `//${snapshot.tag}` };
}
