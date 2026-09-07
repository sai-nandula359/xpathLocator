// sections 12.2-12.5 — Relative, ID-based, Name-based and Class-based XPath. Each attribute
// strategy contributes at most one candidate (the most readable valid form) rather than every
// permutation, per engine rule 9 (preserve readability) — `//*[@id=...]` vs `//tag[@id=...]` are
// functionally interchangeable, so only the more specific, more readable tag-qualified form is
// emitted.

import { isDynamicValue } from "@/engine/dynamicAttributeDetector";
import type { RawCandidate } from "@/engine/types";
import { xpathLiteral } from "@/engine/xpath/util";
import type { ElementSnapshot } from "@/types";

export function generateRelative(snapshot: ElementSnapshot): RawCandidate[] {
  const { tag, attributes, classList } = snapshot;
  const candidates: RawCandidate[] = [];

  const id = attributes.id;
  if (id) {
    candidates.push({
      type: "xpath-id",
      value: `//${tag}[@id=${xpathLiteral(id)}]`,
      usesDynamicAttribute: isDynamicValue(id),
      attributeName: "id",
    });
  }

  const name = attributes.name;
  if (name) {
    candidates.push({
      type: "xpath-name",
      value: `//${tag}[@name=${xpathLiteral(name)}]`,
      usesDynamicAttribute: isDynamicValue(name),
      attributeName: "name",
    });
  }

  if (classList.length > 0) {
    // Prefer a single class token that doesn't look framework-generated; a full exact-@class
    // match is fragile (any unrelated class change breaks it), so this always uses contains().
    const stableToken = classList.find((token) => !isDynamicValue(token)) ?? classList[0];
    candidates.push({
      type: "xpath-class",
      value: `//${tag}[contains(@class, ${xpathLiteral(stableToken)})]`,
      usesDynamicAttribute: isDynamicValue(stableToken),
      attributeName: "class",
    });
  }

  return candidates;
}
