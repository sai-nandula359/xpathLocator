// section 18 — Unique XPath Validation. Builds a self-contained JS snippet meant to be run via
// `<webview>.executeJavaScript(...)`, directly against the live guest-page DOM — no preload
// round trip needed, which is also why this stays well under the 500ms/2s targets in section 73.
// This module only *builds* the script (pure, unit-testable); actually running it against a
// live webview lives in session/liveValidate.ts, since that needs a real webview DOM element.

import type { LocatorCandidate } from "@/types";

export interface RawValidationOutcome {
  valid: boolean;
  matchCount: number;
  visibleMatchCount: number;
  error?: string;
}

// Real sites very commonly render multiple DOM matches for the same id/data-testid/name where
// all but one are hidden — a mobile nav duplicating a desktop one, an inactive tab panel, a
// closed accordion, a template clone. Both counts are always computed and reported (matchCount,
// visibleMatchCount) so the UI can show *why* a locator isn't unique, but see toValidationResult
// below for why only matchCount — never visibility — decides the `unique` flag: a locator that
// still resolves to several real DOM elements isn't safe just because some are hidden right now.
const IS_VISIBLE_FN = `function __slcsIsVisible(el) {
    var rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    var style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    if (parseFloat(style.opacity) === 0) return false;
    return true;
  }`;

// `<webview>.executeJavaScript()` only ever runs against the webview's *top* document — it has
// no notion of "run this inside frame X." An element captured inside a same-origin <iframe>
// (ElementSnapshot.frameSrc) still needs every query below run against *that* frame's own
// document, or it silently searches the wrong document and reports 0 matches for a locator that
// is, in fact, perfectly valid — confirmed live: this was the second half of "can't capture
// inside frames" (capture itself was a separate, already-fixed bug in webview-preload.cjs).
// Resolves to the matching iframe's contentDocument when frameSrc is given (matched by its raw
// src attribute, same value webview-preload.cjs recorded it under), falling back to the top
// document — silently, rather than throwing — if that frame can't be found any more (navigated
// away, removed, ...), since "no matches" is a more honest failure than a crash here.
function rootDocResolverExpr(frameSrc: string | null | undefined): string {
  if (!frameSrc) return "";
  const encodedFrameSrc = JSON.stringify(frameSrc);
  return `
  try {
    var __slcsFrames = document.querySelectorAll('iframe');
    for (var __slcsI = 0; __slcsI < __slcsFrames.length; __slcsI++) {
      if (__slcsFrames[__slcsI].getAttribute('src') === ${encodedFrameSrc}) {
        var __slcsFrameDoc = __slcsFrames[__slcsI].contentDocument;
        if (__slcsFrameDoc) __slcsRootDoc = __slcsFrameDoc;
        break;
      }
    }
  } catch (e) {}
  `;
}

export function buildValidationScript(candidate: LocatorCandidate, frameSrc?: string | null): string {
  const encodedValue = JSON.stringify(candidate.value);
  const resolveRootDoc = `var __slcsRootDoc = document;${rootDocResolverExpr(frameSrc)}`;

  if (candidate.type === "css") {
    return `(function(){
  ${IS_VISIBLE_FN}
  ${resolveRootDoc}
  try {
    var matches = __slcsRootDoc.querySelectorAll(${encodedValue});
    var visible = 0;
    for (var i = 0; i < matches.length; i++) {
      if (__slcsIsVisible(matches[i])) visible++;
    }
    return { valid: true, matchCount: matches.length, visibleMatchCount: visible };
  } catch (e) {
    return { valid: false, matchCount: 0, visibleMatchCount: 0, error: String(e && e.message ? e.message : e) };
  }
})()`;
  }

  return `(function(){
  ${IS_VISIBLE_FN}
  ${resolveRootDoc}
  try {
    var result = __slcsRootDoc.evaluate(
      ${encodedValue}, __slcsRootDoc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null
    );
    var visible = 0;
    for (var i = 0; i < result.snapshotLength; i++) {
      var node = result.snapshotItem(i);
      if (node && node.nodeType === 1 && __slcsIsVisible(node)) visible++;
    }
    return { valid: true, matchCount: result.snapshotLength, visibleMatchCount: visible };
  } catch (e) {
    return { valid: false, matchCount: 0, visibleMatchCount: 0, error: String(e && e.message ? e.message : e) };
  }
})()`;
}

export interface RawIndexOutcome {
  found: boolean;
  index: number;
  error?: string;
}

// section 13/SelectorsHub-parity — indexed disambiguation ((expr)[N]). Only ever invoked as a
// last resort (see captureElement.ts) when nothing validated as unique on its own: re-locates
// the originally-captured element via the always-unique xpath-absolute candidate ("ground
// truth"), then finds that same node's 1-based position within the *target* candidate's own
// match list by reference equality — not by re-deriving a predicate, since the whole point is to
// find "where is *this* element" among duplicates a predicate alone can't distinguish.
export function buildIndexScript(candidate: LocatorCandidate, groundTruthXPath: string, frameSrc?: string | null): string {
  const encodedGroundTruth = JSON.stringify(groundTruthXPath);
  const encodedValue = JSON.stringify(candidate.value);
  const resolveRootDoc = `var __slcsRootDoc = document;${rootDocResolverExpr(frameSrc)}`;
  const matchExpr =
    candidate.type === "css"
      ? `__slcsRootDoc.querySelectorAll(${encodedValue})`
      : `(function(){
        var r = __slcsRootDoc.evaluate(${encodedValue}, __slcsRootDoc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        var nodes = [];
        for (var i = 0; i < r.snapshotLength; i++) nodes.push(r.snapshotItem(i));
        return nodes;
      })()`;

  return `(function(){
  ${resolveRootDoc}
  try {
    var groundTruthResult = __slcsRootDoc.evaluate(
      ${encodedGroundTruth}, __slcsRootDoc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
    );
    var target = groundTruthResult.singleNodeValue;
    if (!target) return { found: false, index: 0, error: 'ground truth element not found' };
    var matches = ${matchExpr};
    for (var i = 0; i < matches.length; i++) {
      if (matches[i] === target) return { found: true, index: i + 1 };
    }
    return { found: false, index: 0 };
  } catch (e) {
    return { found: false, index: 0, error: String(e && e.message ? e.message : e) };
  }
})()`;
}

export function toValidationResult(
  outcome: RawValidationOutcome,
  executionTimeMs: number,
): {
  valid: boolean;
  matchCount: number;
  visibleMatchCount: number;
  unique: boolean;
  executionTimeMs: number;
  error?: string;
  checkedAt: string;
} {
  // Uniqueness is judged on the raw DOM match count, not visibility. A locator that resolves to
  // 4 real elements is not safe to recommend just because 3 of them are currently hidden —
  // Playwright's strict mode throws on exactly that ("resolved to 4 elements"), and Selenium's
  // find_element silently grabs whichever one happens to be first. visibleMatchCount is still
  // reported (see below) for the UI to explain *why* a locator isn't unique, but it must never
  // by itself make a multi-match locator read as safe.
  const unique = outcome.valid && outcome.matchCount === 1;

  return {
    valid: outcome.valid,
    matchCount: outcome.matchCount,
    visibleMatchCount: outcome.visibleMatchCount,
    unique,
    executionTimeMs,
    error: outcome.error,
    checkedAt: new Date().toISOString(),
  };
}
