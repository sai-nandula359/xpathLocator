// section 13 — parent:: axis. Doc example: //label[normalize-space()='Username']/parent::div//input
// Valid whenever the resolved label's parent also contains the target (the common "label and
// input share a wrapper div" form layout) — a strict shared-parent isn't required, since
// `//parent::tag//el` still matches el anywhere beneath that parent, not just as a direct child.
//
// Requires the label itself to be page-unique (AnchorElement.isUnique, checked live at capture
// time in webview-preload.cjs): the whole point of an axis-based locator is to reach the target
// via a reliable reference point, and an anchor that matches multiple elements (e.g. the same
// label text repeated across table rows) produces a locator that inherits that non-uniqueness —
// defeating the purpose.

import { bestPredicateFor } from "@/engine/xpath/util";
import type { RawCandidate } from "@/engine/types";
import type { ElementSnapshot, StabilitySettings } from "@/types";

export function generateParentAxis(snapshot: ElementSnapshot, settings: StabilitySettings): RawCandidate[] {
  const { labelAnchor, tag } = snapshot;
  if (!labelAnchor || !labelAnchor.parentContains || !labelAnchor.element.isUnique) return [];

  const anchorPredicate = bestPredicateFor(labelAnchor.element, settings);
  if (!anchorPredicate) return [];

  const parentTag = snapshot.parentTag ?? "*";

  return [
    {
      type: "xpath-axis",
      axis: "parent",
      value: `//${labelAnchor.element.tag}[${anchorPredicate.predicate}]/parent::${parentTag}//${tag}`,
      usesDynamicAttribute: anchorPredicate.usesDynamicAttribute,
    },
  ];
}
