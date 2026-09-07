// Orchestrates one Ctrl+Click capture end-to-end: generate candidates -> validate against the
// live DOM -> score -> classify -> suggest + disambiguate a name -> check for a probable
// duplicate. Building a CapturedElement is the one place all of engine/ comes together with a
// live webview, which is why it lives in session/ rather than engine/.

import { generateCandidates } from "@/engine/generate";
import { nextId } from "@/engine/xpath/util";
import { disambiguateName, suggestElementName } from "@/engine/namer";
import { classifyCandidates, isPositionalCss, scoreAll, scoreCandidate } from "@/engine/scorer";
import { DEFAULT_STABILITY_SETTINGS } from "@/engine/stabilityConfig";
import { findDuplicate } from "@/session/duplicateDetection";
import { findMatchIndex, validateAll, validateCandidate } from "@/session/liveValidate";
import type { CapturedElement, CaptureSession, ElementSnapshot, LocatorCandidate, StabilitySettings } from "@/types";

export interface CaptureOutcome {
  element: CapturedElement;
  duplicateOf: CapturedElement | null;
}

const ZERO_SCORE = {
  uniqueness: 0,
  attributeStability: 0,
  domDependency: 0,
  readability: 0,
  length: 0,
  dynamicRisk: 0,
  total: 0,
};

/** SelectorsHub-parity last resort (see engine/validator.ts's buildIndexScript): only when
 * *nothing meaningful* validated as unique does this wrap the best-scoring non-absolute XPath
 * candidate with a `(expr)[N]` index, picked by re-locating the captured element (via the
 * always-unique xpath-absolute candidate) among that candidate's own matches. "Meaningful"
 * deliberately excludes xpath-absolute and the positional CSS path — both are unique by
 * construction whenever an ancestor chain exists at all, so including them in the gate would
 * mean this branch almost never fires; they're exactly the low-quality fallback this technique
 * exists to do better than, not evidence the element is already resolved. Scoped this narrowly
 * so it only fires for the case visibility-aware uniqueness can't already resolve — genuinely
 * duplicated *visible* elements — rather than cluttering every capture with an extra candidate. */
async function tryBuildIndexedCandidate(
  webview: ElectronWebviewElement,
  candidates: LocatorCandidate[],
  settings: StabilitySettings,
  frameSrc: string | null,
): Promise<LocatorCandidate | null> {
  const groundTruth = candidates.find((c) => c.type === "xpath-absolute");
  if (!groundTruth) return null;

  const meaningful = candidates.filter((c) => c.type !== "xpath-absolute" && !isPositionalCss(c));
  if (meaningful.length === 0 || meaningful.some((c) => c.validation?.unique)) return null;

  const source = meaningful.filter((c) => c.type !== "css").sort((a, b) => b.score.total - a.score.total)[0];
  if (!source) return null;

  const index = await findMatchIndex(webview, source, groundTruth.value, frameSrc);
  if (index === null) return null;

  const candidate: LocatorCandidate = {
    id: nextId("loc"),
    type: "xpath-indexed",
    value: `(${source.value})[${index}]`,
    usesDynamicAttribute: source.usesDynamicAttribute,
    attributeName: source.attributeName,
    score: { ...ZERO_SCORE },
    classification: "fallback",
  };
  candidate.validation = await validateCandidate(webview, candidate, frameSrc);
  candidate.score = scoreCandidate(candidate, candidate.validation, settings);
  return candidate;
}

export async function captureElement(
  webview: ElectronWebviewElement,
  snapshot: ElementSnapshot,
  session: CaptureSession,
  settings: StabilitySettings = DEFAULT_STABILITY_SETTINGS,
): Promise<CaptureOutcome> {
  const candidates = generateCandidates(snapshot, settings);
  await validateAll(webview, candidates, snapshot.frameSrc);
  scoreAll(candidates, settings);
  classifyCandidates(candidates, settings);

  const indexedCandidate = await tryBuildIndexedCandidate(webview, candidates, settings, snapshot.frameSrc);
  if (indexedCandidate) {
    candidates.push(indexedCandidate);
    classifyCandidates(candidates, settings);
  }

  // Only surface candidates that actually validated as unique against the live DOM — a locator
  // that currently matches more than one element isn't safe to recommend at all, so it has no
  // place in the panel. Falls back to the full (still scored/classified) list only in the rare
  // case where *nothing* validated unique even after the indexed-disambiguation attempt above
  // (e.g. a cross-origin iframe / closed shadow root limited-context capture with no live DOM to
  // validate against at all) so an element is never left with zero locators.
  const uniqueCandidates = candidates.filter((c) => c.validation?.unique);
  const finalCandidates = uniqueCandidates.length > 0 ? uniqueCandidates : candidates;

  const primary = finalCandidates.find((c) => c.classification === "primary") ?? finalCandidates[0] ?? null;

  const existingNames = new Set(session.elements.map((el) => el.name));
  const suggestedName = suggestElementName(snapshot);
  const name = disambiguateName(suggestedName, existingNames, snapshot);

  const now = new Date().toISOString();
  const element: CapturedElement = {
    id: nextId("el"),
    name,
    snapshot,
    candidates: finalCandidates,
    primaryLocatorId: primary?.id ?? null,
    capturedAt: now,
    updatedAt: now,
    version: 1,
  };

  const duplicateOf = findDuplicate(snapshot, session.elements);

  return { element, duplicateOf };
}
