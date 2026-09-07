// section 27 — Cypress. Doc examples:
// cy.get('#loginButton')
// cy.get('[data-testid="login-button"]')
//
// Cypress has no built-in XPath support (it needs the separate cypress-xpath plugin), so unlike
// Selenium/Robot Framework, an XPath fallback here is emitted as cy.xpath(...) with a comment
// flagging the plugin dependency rather than presented as if it works out of the box.

import { bestCandidateForAttribute, bestCandidateOfType, bestFallbackCandidate } from "@/engine/codegen/fallback";
import { DEFAULT_TEST_ID_ATTRIBUTES } from "@/engine/stabilityConfig";
import type { CodeGenerator } from "@/engine/codegen/types";
import type { CapturedElement, LocatorCandidate } from "@/types";

const CSS_ID_SAFE = /^[a-zA-Z_-][a-zA-Z0-9_-]*$/;
const MAX_TEXT_LENGTH = 60;

function isGoodEnough(candidate: LocatorCandidate | null): candidate is LocatorCandidate {
  if (!candidate) return false;
  if (candidate.usesDynamicAttribute) return false;
  if (candidate.validation && !candidate.validation.unique) return false;
  return true;
}

function quoteSingle(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function expression(element: CapturedElement): string {
  const { snapshot } = element;

  const testIdCandidate = bestCandidateOfType(
    element,
    (c) => !!c.attributeName && DEFAULT_TEST_ID_ATTRIBUTES.includes(c.attributeName),
  );
  if (testIdCandidate?.attributeName && isGoodEnough(testIdCandidate)) {
    const value = snapshot.attributes[testIdCandidate.attributeName];
    if (value) return `cy.get(${quoteSingle(`[${testIdCandidate.attributeName}="${value}"]`)})`;
  }

  const id = bestCandidateForAttribute(element, "id");
  if (snapshot.attributes.id && isGoodEnough(id)) {
    const value = snapshot.attributes.id;
    return `cy.get(${quoteSingle(CSS_ID_SAFE.test(value) ? `#${value}` : `[id="${value}"]`)})`;
  }

  const css = bestCandidateOfType(element, (c) => c.type === "css" && isGoodEnough(c));
  if (css) return `cy.get(${quoteSingle(css.value)})`;

  const ownText = (snapshot.text || snapshot.innerText).trim();
  if (ownText && ownText.length <= MAX_TEXT_LENGTH) {
    return `cy.contains(${quoteSingle(ownText)})`;
  }

  const fallback = bestFallbackCandidate(element);
  const xpath = fallback?.value ?? `//${snapshot.tag}`;
  // cypress-xpath plugin required — see module comment.
  return `cy.xpath(${quoteSingle(xpath)})`;
}

export const cypressGenerator: CodeGenerator = {
  id: "cypress",
  label: "Cypress",
  fileExtension: "cy.js",
  generateDeclaration: expression,
  generateBlock: (elements) => elements.map(expression).join("\n"),
};
