// sections 12.7-12.8, 52 — Attribute-based and Combination XPath. Test-id attributes
// (data-testid, data-cy, ...) aren't a separate XPath *syntax* — they're just another
// attribute — so they fall out of this generator naturally and get their high stability score
// from stabilityConfig's priority list, not from special-casing here.

import { isDynamicAttributeName, isDynamicValue } from "@/engine/dynamicAttributeDetector";
import type { RawCandidate } from "@/engine/types";
import { xpathLiteral } from "@/engine/xpath/util";
import type { ElementSnapshot, StabilitySettings } from "@/types";

// Attributes handled elsewhere (id/name/class in relative.ts) are skipped here so every
// attribute contributes exactly one candidate across the whole engine.
const HANDLED_ELSEWHERE = new Set(["id", "name", "class"]);

// A conservative allow-list of attributes worth turning into their own locator, in roughly
// most-to-least useful order. Custom data-* attributes not in this list (including configured
// test-id attributes) are still picked up via the loop below.
const NOTABLE_ATTRIBUTES = [
  "aria-label",
  "aria-labelledby",
  "role",
  "placeholder",
  "title",
  "href",
  "src",
  "alt",
  "type",
  "tabindex",
];

export function generateAttribute(
  snapshot: ElementSnapshot,
  settings: StabilitySettings,
): RawCandidate[] {
  const { tag, attributes, isSensitive } = snapshot;
  const candidates: RawCandidate[] = [];
  const seen = new Set<string>();

  const considerAttr = (attrName: string) => {
    if (HANDLED_ELSEWHERE.has(attrName) || seen.has(attrName)) return;
    if (attrName === "value" && isSensitive) return; // section 57 — never locate on secret values
    const value = attributes[attrName];
    if (!value) return;
    seen.add(attrName);
    candidates.push({
      type: "xpath-attribute",
      value: `//${tag}[@${attrName}=${xpathLiteral(value)}]`,
      usesDynamicAttribute: isDynamicAttributeName(attrName) || isDynamicValue(value),
      attributeName: attrName,
    });
  };

  // Configured test-id attributes first — highest stability priority (section 17/52).
  for (const attrName of settings.testIdAttributes) considerAttr(attrName);
  for (const attrName of NOTABLE_ATTRIBUTES) considerAttr(attrName);
  // Any remaining data-* attribute not already covered — still a plausible locator, just
  // outside the curated list above.
  for (const attrName of Object.keys(attributes)) {
    if (attrName.startsWith("data-")) considerAttr(attrName);
  }

  // section 12.8 — combination candidate: type + name is the doc's own example, and the most
  // common real-world pairing (e.g. distinguishing radio/checkbox groups sharing a name).
  if (attributes.type && attributes.name) {
    candidates.push({
      type: "xpath-combination",
      value: `//${tag}[@type=${xpathLiteral(attributes.type)} and @name=${xpathLiteral(attributes.name)}]`,
      usesDynamicAttribute: isDynamicValue(attributes.type) || isDynamicValue(attributes.name),
    });
  } else if (attributes.type && snapshot.classList.length > 0) {
    const stableToken =
      snapshot.classList.find((token) => !isDynamicValue(token)) ?? snapshot.classList[0];
    candidates.push({
      type: "xpath-combination",
      value: `//${tag}[@type=${xpathLiteral(attributes.type)} and contains(@class, ${xpathLiteral(stableToken)})]`,
      usesDynamicAttribute: isDynamicValue(attributes.type) || isDynamicValue(stableToken),
    });
  }

  return candidates;
}
