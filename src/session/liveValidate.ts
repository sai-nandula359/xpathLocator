// Runs the scripts engine/validator.ts builds against the actual live webview DOM — the part of
// section 18 that needs a real browser, so it can't live in engine/ (which stays jsdom-testable).

import {
  buildIndexScript,
  buildValidationScript,
  toValidationResult,
  type RawIndexOutcome,
  type RawValidationOutcome,
} from "@/engine/validator";
import type { LocatorCandidate, ValidationResult } from "@/types";

export async function validateCandidate(
  webview: ElectronWebviewElement,
  candidate: LocatorCandidate,
  frameSrc?: string | null,
): Promise<ValidationResult> {
  const script = buildValidationScript(candidate, frameSrc);
  const start = performance.now();
  try {
    const outcome = (await webview.executeJavaScript(script)) as RawValidationOutcome;
    return toValidationResult(outcome, performance.now() - start);
  } catch (err) {
    return toValidationResult(
      { valid: false, matchCount: 0, visibleMatchCount: 0, error: err instanceof Error ? err.message : String(err) },
      performance.now() - start,
    );
  }
}

/** Validates every candidate for one element, sequentially — parallel executeJavaScript calls
 * against the same webview can interleave unpredictably, and a handful of candidates per
 * element is cheap enough sequentially to stay under section 73's targets. */
export async function validateAll(
  webview: ElectronWebviewElement,
  candidates: LocatorCandidate[],
  frameSrc?: string | null,
): Promise<void> {
  for (const candidate of candidates) {
    candidate.validation = await validateCandidate(webview, candidate, frameSrc);
  }
}

/** SelectorsHub-parity indexed disambiguation (see captureElement.ts) — finds the captured
 * element's 1-based position within `candidate`'s own match list, using the always-unique
 * `groundTruth` xpath-absolute value to re-identify which match is "ours." Returns null when
 * the element can't be re-located or isn't among the candidate's matches at all. */
export async function findMatchIndex(
  webview: ElectronWebviewElement,
  candidate: LocatorCandidate,
  groundTruth: string,
  frameSrc?: string | null,
): Promise<number | null> {
  const script = buildIndexScript(candidate, groundTruth, frameSrc);
  try {
    const outcome = (await webview.executeJavaScript(script)) as RawIndexOutcome;
    return outcome.found ? outcome.index : null;
  } catch {
    return null;
  }
}
