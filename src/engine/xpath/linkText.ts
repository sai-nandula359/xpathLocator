// section 21 — Link Text / Partial Link Text (Selenium's By.linkText/By.partialLinkText),
// only meaningful for <a> tags, matched against the anchor's own rendered text. This used to be
// synthesized ad hoc, unvalidated, only inside codegen/seleniumStrategy.ts — lifting it here
// means it's generated, live-validated and scored exactly like every other candidate, and
// seleniumStrategy.ts can just pick the best-scored one via bestCandidateOfType() instead.
//
// text() (not normalize-space()) mirrors Selenium's own exact link-text match, which compares
// against the rendered text content rather than a normalized/trimmed variant.

import { isDynamicValue } from "@/engine/dynamicAttributeDetector";
import type { RawCandidate } from "@/engine/types";
import { xpathLiteral } from "@/engine/xpath/util";
import type { ElementSnapshot } from "@/types";

export const MAX_LINK_TEXT_LENGTH = 60;
export const PARTIAL_LINK_TEXT_LENGTH = 30;

export function generateLinkText(snapshot: ElementSnapshot): RawCandidate[] {
  if (snapshot.tag !== "a") return [];

  const text = (snapshot.text || snapshot.innerText).trim();
  if (!text) return [];

  const candidates: RawCandidate[] = [];

  if (text.length <= MAX_LINK_TEXT_LENGTH) {
    candidates.push({
      type: "xpath-linktext",
      value: `//a[text()=${xpathLiteral(text)}]`,
      usesDynamicAttribute: isDynamicValue(text),
    });
  }

  const partial = text.slice(0, PARTIAL_LINK_TEXT_LENGTH).trim();
  if (partial) {
    candidates.push({
      type: "xpath-partial-linktext",
      value: `//a[contains(text(), ${xpathLiteral(partial)})]`,
      usesDynamicAttribute: isDynamicValue(partial),
    });
  }

  return candidates;
}
