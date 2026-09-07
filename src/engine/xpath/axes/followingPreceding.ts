// section 13/14 — following:: and preceding:: axes. Doc's own section-14 worked example lists
// this *alongside* parent:: for the same field (`//label[...]/following::input[1]` and
// `//label[...]/parent::div//input` both appear as candidates for the same username input), so
// this generates regardless of whether the label shares a parent with the target — it's an
// alternative, not a fallback for when parent::/sibling:: don't apply. sibling.ts additionally
// offers the more tightly-scoped following-sibling::/preceding-sibling:: form when they do
// share a parent, as a *more* specific option, not a replacement for this one. Direction comes
// straight from document order, computed once at capture time via Node.compareDocumentPosition
// (see webview-preload.cjs).
//
// Requires the label to be page-unique (AnchorElement.isUnique). This matters more here than
// almost anywhere else: `//label[X]/following::input[1]` evaluates the predicate as a node-set
// first — if X matches multiple labels (e.g. the same field repeated across table rows), XPath
// applies `following::input[1]` to *each* label independently and unions the results, so the
// "unique-looking" [1] index silently produces one match per repeated row instead of one match
// total. A non-unique anchor here doesn't just risk a bad locator, it actively produces a
// locator that looks precise but isn't.

import { bestPredicateFor } from "@/engine/xpath/util";
import type { RawCandidate } from "@/engine/types";
import type { ElementSnapshot, StabilitySettings } from "@/types";

export function generateFollowingPrecedingAxis(
  snapshot: ElementSnapshot,
  settings: StabilitySettings,
): RawCandidate[] {
  const { labelAnchor, tag } = snapshot;
  if (!labelAnchor || !labelAnchor.element.isUnique) return [];

  const anchorPredicate = bestPredicateFor(labelAnchor.element, settings);
  if (!anchorPredicate) return [];

  const axis = labelAnchor.documentOrder === "before" ? "following" : "preceding";

  return [
    {
      type: "xpath-axis",
      axis,
      value: `//${labelAnchor.element.tag}[${anchorPredicate.predicate}]/${axis}::${tag}[1]`,
      usesDynamicAttribute: anchorPredicate.usesDynamicAttribute,
    },
  ];
}
