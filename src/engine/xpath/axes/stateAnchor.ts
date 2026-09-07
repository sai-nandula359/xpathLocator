// SelectorsHub-parity ask: indexed disambiguation ((expr)[N]) is fragile to DOM reordering — any
// insertion/removal/reorder among the matched elements silently repoints it at a different one.
// When a page renders the *same* widget several times (a tabbed search form, one copy per tab)
// and no ordinary attribute anywhere in the ancestor chain is unique, there's often still a real
// DOM/accessibility *state* attribute — hidden, aria-hidden, aria-selected, aria-expanded, a
// tabindex="-1" convention, or a semantic class token — that distinguishes the active copy from
// its duplicates. electron/webview-preload.cjs's resolveStateAnchor() finds and live-verifies
// that combination at capture time (base predicate AND state predicate together match exactly
// one element); this generator turns it into a real XPath axis expression. Because the state
// condition is baked into the XPath predicate itself — not a separate visibility overlay, see
// engine/validator.ts for why that distinction matters — the result is exactly as "real" to
// Playwright/Selenium as any other attribute-based locator, and survives DOM reordering the same
// way any other axis-based candidate does, unlike positional indexing.

import { bestPredicateFor } from "@/engine/xpath/util";
import type { RawCandidate } from "@/engine/types";
import type { ElementSnapshot, StabilitySettings } from "@/types";

export function generateStateAnchorAxis(snapshot: ElementSnapshot, settings: StabilitySettings): RawCandidate[] {
  const { stateAnchor, tag } = snapshot;
  if (!stateAnchor) return [];

  // Deliberately does NOT gate on stateAnchor.element.isUnique the way the other axis generators
  // gate on their anchor's isUnique — this anchor's own best predicate is *expected* to be
  // non-unique (it matches every duplicate copy of the widget); the disambiguating power comes
  // from combining it with statePredicate, already live-verified by resolveStateAnchor().
  const basePredicate = bestPredicateFor(stateAnchor.element, settings);
  const ownPredicate = bestPredicateFor(snapshot, settings);
  if (!basePredicate || !ownPredicate) return [];

  const anchorStep = `${stateAnchor.element.tag}[${basePredicate.predicate} and ${stateAnchor.statePredicate}]`;
  const targetStep = `${tag}[${ownPredicate.predicate}]`;
  const usesDynamicAttribute = basePredicate.usesDynamicAttribute || ownPredicate.usesDynamicAttribute;

  return [
    {
      type: "xpath-axis",
      axis: "descendant",
      value: `//${anchorStep}//${targetStep}`,
      usesDynamicAttribute,
      attributeName: ownPredicate.attributeName,
    },
  ];
}
