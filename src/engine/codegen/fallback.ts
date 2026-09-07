import type { CapturedElement, LocatorCandidate } from "@/types";

/** The element's primary candidate, or (failing that) its best-scored candidate — used when a
 * framework has no more specific native strategy available for this particular element. */
export function bestFallbackCandidate(element: CapturedElement): LocatorCandidate | null {
  const primary = element.candidates.find((c) => c.id === element.primaryLocatorId);
  if (primary) return primary;
  if (element.candidates.length === 0) return null;
  return [...element.candidates].sort((a, b) => b.score.total - a.score.total)[0];
}

/** Best-scored candidate of a specific type (e.g. "css" or any "xpath-*"), or null. */
export function bestCandidateOfType(
  element: CapturedElement,
  predicate: (candidate: LocatorCandidate) => boolean,
): LocatorCandidate | null {
  const matches = element.candidates.filter(predicate).sort((a, b) => b.score.total - a.score.total);
  return matches[0] ?? null;
}

/** Best-scored candidate keyed on a specific attribute (e.g. "id", "name"), or null. */
export function bestCandidateForAttribute(element: CapturedElement, attributeName: string): LocatorCandidate | null {
  return bestCandidateOfType(element, (c) => c.attributeName === attributeName);
}
