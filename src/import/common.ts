// Shared reconstruction helpers for session import (JSON/CSV/Excel). Every exporter in
// src/export/ is lossy in a different way (missing id, score breakdown, full snapshot,
// validation, ...) — importing rebuilds a *placeholder* CapturedElement good enough to display
// and re-validate, not a byte-for-byte round-trip. Users re-validate/re-generate richer
// candidates via the existing Repair action (session/repairLocator.ts) after import.

import { nextId } from "@/engine/xpath/util";
import type { CapturedElement, ElementSnapshot, LocatorCandidate, LocatorType } from "@/types";

const ZERO_SCORE = {
  uniqueness: 0,
  attributeStability: 0,
  domDependency: 0,
  readability: 0,
  length: 0,
  dynamicRisk: 0,
  total: 0,
};

export function buildStubSnapshot(overrides: { tag?: string; text?: string } = {}): ElementSnapshot {
  const text = overrides.text ?? "";
  return {
    tag: overrides.tag?.toLowerCase() || "*",
    text,
    innerText: text,
    outerHtml: "",
    attributes: {},
    classList: [],
    parentTag: null,
    parentAttributes: null,
    siblingIndex: 0,
    siblingCount: 1,
    tagSiblingCount: 1,
    childTags: [],
    domDepth: 0,
    nearbyLabelText: null,
    ancestorChain: [],
    isSensitive: false,
    limitedContext: null,
    pageUrl: "",
    pageTitle: "",
    labelAnchor: null,
    landmarkAncestor: null,
    siblingAnchors: { previous: null, next: null },
    stateAnchor: null,
    frameSrc: null,
    viewportWidth: 0,
    viewportHeight: 0,
  };
}

/** A raw locator value from an imported file has no trustworthy declared type — inferred from
 * its own shape instead of a "type"/"Locator Type" column, both because that column can be
 * missing/wrong (a hand-edited file) and because the same column always means "this candidate's
 * value string", regardless of which generator originally produced it. Only the css/xpath
 * split matters for re-validation (engine/validator.ts branches on exactly that); the finer
 * xpath-* sub-kind only affects cosmetic labeling (see engine/locatorLabel.ts), so a generic
 * "xpath-attribute" is a safe stand-in for any non-CSS value. */
export function inferLocatorType(value: string): LocatorType {
  return value.startsWith("//") || value.startsWith("(") ? "xpath-attribute" : "css";
}

export interface ImportedCandidateInput {
  value: string;
  attributeName?: string;
  classification?: "primary" | "secondary" | "fallback";
}

function makeImportedCandidate(input: ImportedCandidateInput): LocatorCandidate {
  return {
    id: nextId("loc"),
    type: inferLocatorType(input.value),
    value: input.value,
    usesDynamicAttribute: false,
    attributeName: input.attributeName,
    score: { ...ZERO_SCORE },
    classification: input.classification ?? "fallback",
    validation: undefined,
  };
}

export function buildImportedElement(
  name: string,
  snapshot: ElementSnapshot,
  candidateInputs: ImportedCandidateInput[],
): CapturedElement {
  const seen = new Set<string>();
  const candidates: LocatorCandidate[] = [];
  for (const input of candidateInputs) {
    const value = input.value.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    candidates.push(makeImportedCandidate({ ...input, value }));
  }
  const primary = candidates.find((c) => c.classification === "primary") ?? candidates[0] ?? null;
  const now = new Date().toISOString();
  return {
    id: nextId("el"),
    name,
    snapshot,
    candidates,
    primaryLocatorId: primary?.id ?? null,
    capturedAt: now,
    updatedAt: now,
    version: 1,
  };
}

/** First tag-like token off an XPath value (e.g. "//button[@id='x']" -> "button") — the only tag
 * hint some import formats (JSON) carry at all, since they don't export a Tag column. */
export function guessTagFromXPath(value: string | undefined): string {
  const match = value?.match(/^\/\/([a-zA-Z][\w-]*)/);
  return match ? match[1] : "*";
}
