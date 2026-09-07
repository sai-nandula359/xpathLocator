// section 13 — child:: axis. Doc example: //form[@id='loginForm']/child::div[1]
// Only meaningful when the landmark is exactly the target's grandparent (depth 1 from the
// target's parent) — otherwise "child" wouldn't actually reach the intermediate element on
// the way down to the target, and descendant:: (see descendant.ts) is the correct axis instead.
//
// The doc's example stops at the intermediate div, but a candidate that doesn't actually
// resolve to the *captured element itself* would validate against the wrong node (matching the
// wrapper div, not e.g. the input inside it) — so this always finishes with one more step down
// to the real target, using its own tag+position from the ancestor chain.

import { bestPredicateFor } from "@/engine/xpath/util";
import type { RawCandidate } from "@/engine/types";
import type { ElementSnapshot, StabilitySettings } from "@/types";

export function generateChildAxis(snapshot: ElementSnapshot, settings: StabilitySettings): RawCandidate[] {
  const { landmarkAncestor, ancestorChain } = snapshot;
  if (!landmarkAncestor || landmarkAncestor.depth !== 1) return [];
  if (!landmarkAncestor.element.isUnique) return []; // see ancestor.ts for why this matters
  if (ancestorChain.length < 2) return [];

  const landmarkPredicate = bestPredicateFor(landmarkAncestor.element, settings);
  if (!landmarkPredicate) return [];

  // The target's parent is the direct child of the landmark we're stepping through; the target
  // itself is one more direct-child step down from there.
  const parentSegment = ancestorChain[ancestorChain.length - 2];
  const targetSegment = ancestorChain[ancestorChain.length - 1];

  return [
    {
      type: "xpath-axis",
      axis: "child",
      value: `//${landmarkAncestor.element.tag}[${landmarkPredicate.predicate}]/child::${parentSegment.tag}[${parentSegment.index}]/${targetSegment.tag}[${targetSegment.index}]`,
      usesDynamicAttribute: landmarkPredicate.usesDynamicAttribute,
    },
  ];
}
