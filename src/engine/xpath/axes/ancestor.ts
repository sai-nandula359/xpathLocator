// section 13 — ancestor:: axis. Doc example:
// //span[normalize-space()='Username']/ancestor::div[contains(@class,'form-group')]//input
// Anchored on the resolved label (a landmark ancestor found without a nearby label to anchor
// on isn't useful here — see descendant.ts for the label-less case, which anchors on the
// target itself instead).
//
// Both the label and the landmark must be page-unique (AnchorElement.isUnique) — an anchor
// that matches multiple elements on the page produces a locator that inherits that
// non-uniqueness, which defeats the entire purpose of reaching for an axis.

import { bestPredicateFor } from "@/engine/xpath/util";
import type { RawCandidate } from "@/engine/types";
import type { ElementSnapshot, StabilitySettings } from "@/types";

export function generateAncestorAxis(snapshot: ElementSnapshot, settings: StabilitySettings): RawCandidate[] {
  const { labelAnchor, landmarkAncestor, tag } = snapshot;
  if (!labelAnchor || !landmarkAncestor) return [];
  if (!labelAnchor.element.isUnique || !landmarkAncestor.element.isUnique) return [];

  const anchorPredicate = bestPredicateFor(labelAnchor.element, settings);
  const landmarkPredicate = bestPredicateFor(landmarkAncestor.element, settings);
  if (!anchorPredicate || !landmarkPredicate) return [];

  return [
    {
      type: "xpath-axis",
      axis: "ancestor",
      value: `//${labelAnchor.element.tag}[${anchorPredicate.predicate}]/ancestor::${landmarkAncestor.element.tag}[${landmarkPredicate.predicate}]//${tag}`,
      usesDynamicAttribute: anchorPredicate.usesDynamicAttribute || landmarkPredicate.usesDynamicAttribute,
    },
  ];
}
