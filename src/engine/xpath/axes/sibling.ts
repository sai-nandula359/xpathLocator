// section 13 — following-sibling:: and preceding-sibling:: axes. Doc examples:
// //label[normalize-space()='Username']/following-sibling::input
// //input[@name='username']/preceding-sibling::label
// Preferred over the general following::/preceding:: (followingPreceding.ts) whenever the
// anchor and target are direct siblings — a sibling-scoped axis can't accidentally match some
// unrelated element elsewhere on the page the way a whole-document following::/preceding:: can.
// Still requires the anchor to be page-unique (AnchorElement.isUnique) for the same reason
// followingPreceding.ts does: if the anchor's predicate matches multiple elements (e.g. a
// repeated row), the sibling step applies to each match independently and the results union,
// silently producing one match per repeated instance instead of one overall.

import { bestPredicateFor } from "@/engine/xpath/util";
import type { RawCandidate } from "@/engine/types";
import type { AnchorElement, ElementSnapshot, StabilitySettings } from "@/types";

function candidateFor(
  anchor: AnchorElement,
  axis: "following-sibling" | "preceding-sibling",
  tag: string,
  settings: StabilitySettings,
): RawCandidate | null {
  if (!anchor.isUnique) return null;
  const predicate = bestPredicateFor(anchor, settings);
  if (!predicate) return null;
  return {
    type: "xpath-axis",
    axis,
    value: `//${anchor.tag}[${predicate.predicate}]/${axis}::${tag}`,
    usesDynamicAttribute: predicate.usesDynamicAttribute,
  };
}

export function generateSiblingAxis(snapshot: ElementSnapshot, settings: StabilitySettings): RawCandidate[] {
  const { labelAnchor, siblingAnchors, tag } = snapshot;
  const results: RawCandidate[] = [];

  if (labelAnchor?.sharesParent) {
    const axis = labelAnchor.documentOrder === "before" ? "following-sibling" : "preceding-sibling";
    const c = candidateFor(labelAnchor.element, axis, tag, settings);
    if (c) results.push(c);
  }

  if (siblingAnchors.previous) {
    // The anchor sits *before* the target, so — starting from the anchor — the target is
    // reached by looking forward.
    const c = candidateFor(siblingAnchors.previous, "following-sibling", tag, settings);
    if (c) results.push(c);
  }
  if (siblingAnchors.next) {
    // The anchor sits *after* the target, so — starting from the anchor — the target is
    // reached by looking backward.
    const c = candidateFor(siblingAnchors.next, "preceding-sibling", tag, settings);
    if (c) results.push(c);
  }

  return results;
}
