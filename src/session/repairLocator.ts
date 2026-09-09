// section 34 — Locator Repair: "The system should suggest stronger replacements when a locator
// is non-unique or fails." When a captured element's current Primary is no longer valid/unique
// against the live DOM (the page changed since capture), this re-validates every already-
// generated candidate for that element and promotes whichever one is now the strongest
// validated-unique replacement — the doc's own worked example: a @class-based locator degrades
// to Matches=4, and an already-generated @data-testid candidate (Matches=1) takes over as
// Primary. Deliberately scoped to candidates generated at capture time rather than inventing
// brand-new ones from the current DOM — repairing against a genuinely different page shape needs
// a fresh capture, not a repair; see `unrepairable` below for that case.

import { classifyCandidates, scoreAll } from "@/engine/scorer";
import { DEFAULT_STABILITY_SETTINGS } from "@/engine/stabilityConfig";
import { validateAll } from "@/session/liveValidate";
import type { CapturedElement, LocatorCandidate, StabilitySettings } from "@/types";

export interface RepairOutcome {
  /** True when the previous Primary was broken (invalid, non-unique, or never validated) and,
   * after re-validating every stored candidate, some candidate now validates unique. */
  repaired: boolean;
  /** True when *nothing* among the stored candidates currently validates as unique — repair
   * can't help here; the element needs re-capturing against the current page. */
  unrepairable: boolean;
  previousPrimary: LocatorCandidate | null;
  newPrimary: LocatorCandidate | null;
  /** The full candidate list, freshly re-validated/scored/classified — replaces the element's
   * existing `candidates` array. */
  candidates: LocatorCandidate[];
}

export async function repairElement(
  webview: ElectronWebviewElement,
  element: CapturedElement,
  settings: StabilitySettings = DEFAULT_STABILITY_SETTINGS,
): Promise<RepairOutcome> {
  const previousPrimaryId = element.primaryLocatorId;

  const candidates = element.candidates.map((c) => ({ ...c }));
  await validateAll(webview, candidates, element.snapshot.frameSrc);
  scoreAll(candidates, settings);
  classifyCandidates(candidates, settings);

  // Looked up from the freshly re-validated array, not the element's stale pre-repair state —
  // "was it broken" has to mean "is it broken right now," which we only know after revalidating.
  const previousPrimary = candidates.find((c) => c.id === previousPrimaryId) ?? null;
  const newPrimary = candidates.find((c) => c.classification === "primary") ?? null;
  const wasBroken = !previousPrimary?.validation?.unique;
  const nowFixed = !!newPrimary?.validation?.unique;

  return {
    repaired: wasBroken && nowFixed,
    unrepairable: !candidates.some((c) => c.validation?.unique),
    previousPrimary,
    newPrimary,
    candidates,
  };
}
