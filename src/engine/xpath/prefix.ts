// section 12 — starts-with(). A dynamic-looking attribute value (a framework-generated id,
// timestamp suffix, ...) is currently just skipped by relative.ts/attribute.ts's plain-equality
// candidates, since matching it exactly would break the moment the app rebuilds. But when that
// value has a genuinely stable literal chunk in front of the dynamic part — see
// dynamicAttributeDetector.ts's extractStablePrefix() for the real-world example this is built
// from — starts-with(@attr, 'prefix') anchors on exactly that stable portion instead of
// discarding the attribute entirely. Only fires where a plain equality candidate wouldn't (the
// value has to actually be flagged dynamic first) — a stable value already gets a strictly
// better exact-match candidate elsewhere.

import { extractStablePrefix, isDynamicAttributeName, isDynamicValue } from "@/engine/dynamicAttributeDetector";
import type { RawCandidate } from "@/engine/types";
import { xpathLiteral } from "@/engine/xpath/util";
import type { ElementSnapshot, StabilitySettings } from "@/types";

function prefixCandidate(tag: string, attrName: string, value: string): RawCandidate | null {
  if (!isDynamicValue(value)) return null;
  const prefix = extractStablePrefix(value);
  if (!prefix) return null;
  return {
    type: "xpath-attribute",
    value: `//${tag}[starts-with(@${attrName}, ${xpathLiteral(prefix)})]`,
    usesDynamicAttribute: isDynamicAttributeName(attrName),
    attributeName: attrName,
  };
}

export function generatePrefixCandidates(
  snapshot: ElementSnapshot,
  settings: StabilitySettings,
): RawCandidate[] {
  const { tag, attributes, classList } = snapshot;
  const candidates: RawCandidate[] = [];

  if (attributes.id) {
    const c = prefixCandidate(tag, "id", attributes.id);
    if (c) candidates.push(c);
  }

  for (const attr of settings.testIdAttributes) {
    if (attributes[attr]) {
      const c = prefixCandidate(tag, attr, attributes[attr]);
      if (c) candidates.push(c);
    }
  }

  // starts-with(@class, 'x') only checks the *start* of the whole class attribute, so it's only
  // a correct locator when the dynamic token is the first class listed — contains() (already
  // generated in relative.ts) is the safe general-purpose choice for a token anywhere else.
  if (classList.length > 0) {
    const c = prefixCandidate(tag, "class", classList[0]);
    if (c) candidates.push(c);
  }

  return candidates;
}
