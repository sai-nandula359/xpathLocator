// section 12.6 — Text-based XPath. text() only matches an element's own direct text-node
// children, while normalize-space() with no argument evaluates the context node's full
// string-value (all descendant text concatenated) — so text() candidates use `snapshot.text`
// (own text) and normalize-space() candidates use `snapshot.innerText` (full rendered text),
// matching what each XPath function actually computes rather than treating them as interchangeable.

import { isDynamicValue } from "@/engine/dynamicAttributeDetector";
import type { RawCandidate } from "@/engine/types";
import { xpathLiteral } from "@/engine/xpath/util";
import type { ElementSnapshot } from "@/types";

const MAX_EQUALITY_LENGTH = 80;
const CONTAINS_PREFIX_LENGTH = 40;

export function generateText(snapshot: ElementSnapshot): RawCandidate[] {
  const { tag } = snapshot;
  const candidates: RawCandidate[] = [];

  const ownText = snapshot.text.trim();
  if (ownText && ownText.length <= MAX_EQUALITY_LENGTH) {
    candidates.push({
      type: "xpath-text",
      value: `//${tag}[text()=${xpathLiteral(ownText)}]`,
      usesDynamicAttribute: isDynamicValue(ownText),
    });
  }

  const fullText = snapshot.innerText.trim();
  if (fullText) {
    if (fullText.length <= MAX_EQUALITY_LENGTH) {
      candidates.push({
        type: "xpath-text",
        value: `//${tag}[normalize-space()=${xpathLiteral(fullText)}]`,
        usesDynamicAttribute: isDynamicValue(fullText),
      });
    } else {
      const prefix = fullText.slice(0, CONTAINS_PREFIX_LENGTH).trim();
      candidates.push({
        type: "xpath-text",
        value: `//${tag}[contains(normalize-space(), ${xpathLiteral(prefix)})]`,
        usesDynamicAttribute: isDynamicValue(prefix),
      });
    }
  }

  return candidates;
}
