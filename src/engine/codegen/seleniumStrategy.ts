// Shared "which native Selenium By.* strategy fits this element" logic for all three Selenium
// targets (Java/Python/C# — seleniumJava.ts, seleniumPython.ts, seleniumCsharp.ts each just
// format this same decision in their own syntax).

import { bestCandidateForAttribute, bestCandidateOfType, bestFallbackCandidate } from "@/engine/codegen/fallback";
import type { CapturedElement, LocatorCandidate } from "@/types";

export type SeleniumStrategyKind = "id" | "name" | "className" | "linkText" | "css" | "xpath";

export interface SeleniumStrategy {
  kind: SeleniumStrategyKind;
  value: string;
}

const MAX_LINK_TEXT_LENGTH = 60;

function isGoodEnough(candidate: LocatorCandidate | null): candidate is LocatorCandidate {
  if (!candidate) return false;
  if (candidate.usesDynamicAttribute) return false;
  if (candidate.validation && !candidate.validation.unique) return false;
  return true;
}

export function pickSeleniumStrategy(element: CapturedElement): SeleniumStrategy {
  const { snapshot } = element;

  const id = bestCandidateForAttribute(element, "id");
  if (snapshot.attributes.id && isGoodEnough(id)) {
    return { kind: "id", value: snapshot.attributes.id };
  }

  const name = bestCandidateForAttribute(element, "name");
  if (snapshot.attributes.name && isGoodEnough(name)) {
    return { kind: "name", value: snapshot.attributes.name };
  }

  // By.className only accepts a single class token — no contains()/multi-class support like
  // our XPath/CSS class candidates have, so this only applies when the element has exactly one.
  if (snapshot.classList.length === 1) {
    const classCandidate = bestCandidateForAttribute(element, "class");
    if (isGoodEnough(classCandidate)) {
      return { kind: "className", value: snapshot.classList[0] };
    }
  }

  if (snapshot.tag === "a") {
    const text = (snapshot.text || snapshot.innerText).trim();
    if (text && text.length <= MAX_LINK_TEXT_LENGTH) {
      return { kind: "linkText", value: text };
    }
  }

  const css = bestCandidateOfType(element, (c) => c.type === "css" && isGoodEnough(c));
  if (css) return { kind: "css", value: css.value };

  const fallback = bestFallbackCandidate(element);
  if (fallback) return { kind: "xpath", value: fallback.value };

  return { kind: "xpath", value: `//${snapshot.tag}` };
}
