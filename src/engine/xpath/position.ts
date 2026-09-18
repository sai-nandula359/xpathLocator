// section 15 — position()/last(). A more readable, native alternative to the (expr)[N] indexed
// fallback (see session/captureElement.ts's tryBuildIndexedCandidate): both are equally fragile
// to DOM reordering, but `//tag[position()=N]`/`//tag[last()]` read as ordinary XPath rather than
// an opaque wrapped-and-indexed expression, and — unlike the indexed fallback, which only ever
// gets built live as a last resort after nothing else validates unique — these can be generated
// statically straight from the snapshot's own tag-filtered sibling position (ancestorChain's own
// last segment already records this; see engine/xpath/absolute.ts) and count (tagSiblingCount).
//
// Note this operates over tag-filtered siblings (only children sharing this element's tag name),
// matching what position()/last() actually count for a `tag[...]` location step — not
// siblingIndex/siblingCount, which count every child regardless of tag.

import type { RawCandidate } from "@/engine/types";
import type { ElementSnapshot } from "@/types";

export function generatePosition(snapshot: ElementSnapshot): RawCandidate[] {
  const { tag, ancestorChain, tagSiblingCount } = snapshot;
  if (ancestorChain.length === 0) return [];

  const own = ancestorChain[ancestorChain.length - 1];
  if (own.tag !== tag || own.index < 1) return [];

  // Only one element of this tag under its parent — position()=1 would be exactly as ambiguous
  // as a bare `//tag` step, adding nothing.
  if (!tagSiblingCount || tagSiblingCount <= 1) return [];

  const candidates: RawCandidate[] = [
    {
      type: "xpath-position",
      value: `//${tag}[position()=${own.index}]`,
      usesDynamicAttribute: false,
    },
  ];

  if (own.index === tagSiblingCount) {
    candidates.push({
      type: "xpath-position",
      value: `//${tag}[last()]`,
      usesDynamicAttribute: false,
    });
  }

  return candidates;
}
