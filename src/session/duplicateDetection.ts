// section 41 — Duplicate Detection. Re-capturing "the same" element should prompt Update
// Existing / Create New Version / Cancel rather than silently adding a near-identical row.

import type { AncestorSegment, CapturedElement, ElementSnapshot } from "@/types";

function samePath(a: AncestorSegment[], b: AncestorSegment[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((seg, i) => seg.tag === b[i].tag && seg.index === b[i].index);
}

/**
 * An element counts as "probably the same" as a previously captured one when they're on the
 * same page and either share a stable id, or occupy the exact same structural position
 * (identical absolute ancestor path) — either signal alone is a strong enough match in
 * practice, and requiring both would miss the common case of an id being reassigned on rerender.
 */
export function findDuplicate(
  snapshot: ElementSnapshot,
  existing: CapturedElement[],
): CapturedElement | null {
  const sameUrl = existing.filter((el) => el.snapshot.pageUrl === snapshot.pageUrl);
  if (sameUrl.length === 0) return null;

  const id = snapshot.attributes.id;
  if (id) {
    const byId = sameUrl.find(
      (el) => el.snapshot.tag === snapshot.tag && el.snapshot.attributes.id === id,
    );
    if (byId) return byId;
  }

  return (
    sameUrl.find(
      (el) => el.snapshot.tag === snapshot.tag && samePath(el.snapshot.ancestorChain, snapshot.ancestorChain),
    ) ?? null
  );
}
