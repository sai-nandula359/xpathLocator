// section 13 — descendant:: axis. Doc example:
// //form[@id='loginForm']/descendant::input[@name='username']
// Anchored on the landmark ancestor and the target's own best predicate — unlike ancestor.ts,
// this doesn't need a resolved label, since descendant:: reaches any depth below the landmark.
// Requires the landmark itself to be page-unique (AnchorElement.isUnique) — see ancestor.ts for
// why; the target's own predicate is still independently live-validated afterwards, same as
// every other candidate, so this doesn't guarantee uniqueness on its own, just removes the
// "anchor is already wrong" failure mode.
//
// Emits two forms of the same relationship: the doc's own literal `descendant::` syntax, and
// the `//` shorthand (`descendant::` restricted to element nodes is what `//` expands to when
// chained after a step) that real-world tools — SelectorsHub included — show by default, since
// testers overwhelmingly read/write that form. Both carry the same `axis: "descendant"` tag for
// scoring, so this doesn't change ranking, just which spelling is offered.

import { bestPredicateFor } from "@/engine/xpath/util";
import type { RawCandidate } from "@/engine/types";
import type { ElementSnapshot, StabilitySettings } from "@/types";

export function generateDescendantAxis(snapshot: ElementSnapshot, settings: StabilitySettings): RawCandidate[] {
  const { landmarkAncestor, tag } = snapshot;
  if (!landmarkAncestor || !landmarkAncestor.element.isUnique) return [];

  const landmarkPredicate = bestPredicateFor(landmarkAncestor.element, settings);
  const ownPredicate = bestPredicateFor(snapshot, settings);
  if (!landmarkPredicate || !ownPredicate) return [];

  const landmarkStep = `${landmarkAncestor.element.tag}[${landmarkPredicate.predicate}]`;
  const targetStep = `${tag}[${ownPredicate.predicate}]`;
  const usesDynamicAttribute = landmarkPredicate.usesDynamicAttribute || ownPredicate.usesDynamicAttribute;

  return [
    {
      type: "xpath-axis",
      axis: "descendant",
      value: `//${landmarkStep}/descendant::${targetStep}`,
      usesDynamicAttribute,
      attributeName: ownPredicate.attributeName,
    },
    {
      type: "xpath-axis",
      axis: "descendant",
      value: `//${landmarkStep}//${targetStep}`,
      usesDynamicAttribute,
      attributeName: ownPredicate.attributeName,
    },
  ];
}
