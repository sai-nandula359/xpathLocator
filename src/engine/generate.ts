import { generateCss, generatePositionalCss } from "@/engine/css";
import { DEFAULT_STABILITY_SETTINGS } from "@/engine/stabilityConfig";
import { generateAbsolute } from "@/engine/xpath/absolute";
import { generateAncestorAxis } from "@/engine/xpath/axes/ancestor";
import { generateChildAxis } from "@/engine/xpath/axes/child";
import { generateDescendantAxis } from "@/engine/xpath/axes/descendant";
import { generateFollowingPrecedingAxis } from "@/engine/xpath/axes/followingPreceding";
import { generateParentAxis } from "@/engine/xpath/axes/parent";
import { generateSelfAxis } from "@/engine/xpath/axes/self";
import { generateSiblingAxis } from "@/engine/xpath/axes/sibling";
import { generateStateAnchorAxis } from "@/engine/xpath/axes/stateAnchor";
import { generateAttribute } from "@/engine/xpath/attribute";
import { generateLinkText } from "@/engine/xpath/linkText";
import { generatePosition } from "@/engine/xpath/position";
import { generatePrefixCandidates } from "@/engine/xpath/prefix";
import { generateRelative } from "@/engine/xpath/relative";
import { generateText } from "@/engine/xpath/text";
import { nextId } from "@/engine/xpath/util";
import type { ElementSnapshot, LocatorCandidate, StabilitySettings } from "@/types";

const ZERO_SCORE = {
  uniqueness: 0,
  attributeStability: 0,
  domDependency: 0,
  readability: 0,
  length: 0,
  dynamicRisk: 0,
  total: 0,
};

/**
 * Runs every generator against a captured element and returns de-duplicated, unscored
 * candidates (score/classification are filled in afterwards by scorer.ts, once each candidate
 * has been validated against the live DOM — see session/liveValidate.ts).
 */
export function generateCandidates(
  snapshot: ElementSnapshot,
  settings: StabilitySettings = DEFAULT_STABILITY_SETTINGS,
): LocatorCandidate[] {
  const raw = [
    ...generateRelative(snapshot),
    ...generateAttribute(snapshot, settings),
    ...generatePrefixCandidates(snapshot, settings),
    ...generateText(snapshot),
    ...generateLinkText(snapshot),
    ...generatePosition(snapshot),
    ...generateCss(snapshot, settings),
    ...generateAbsolute(snapshot),
    ...generatePositionalCss(snapshot),
    // section 13/14 — axis-based "Smart XPath Generation"; each of these is a no-op unless the
    // relevant anchor/landmark context was found at capture time (most elements won't have all
    // of it, and that's expected — axes are supplementary, not always-applicable).
    ...generateParentAxis(snapshot, settings),
    ...generateAncestorAxis(snapshot, settings),
    ...generateChildAxis(snapshot, settings),
    ...generateDescendantAxis(snapshot, settings),
    ...generateStateAnchorAxis(snapshot, settings),
    ...generateFollowingPrecedingAxis(snapshot, settings),
    ...generateSiblingAxis(snapshot, settings),
    ...generateSelfAxis(snapshot),
  ];

  const seen = new Set<string>();
  const candidates: LocatorCandidate[] = [];
  for (const candidate of raw) {
    const key = `${candidate.type}::${candidate.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({
      id: nextId("loc"),
      type: candidate.type,
      value: candidate.value,
      usesDynamicAttribute: candidate.usesDynamicAttribute,
      attributeName: candidate.attributeName,
      axis: candidate.axis,
      score: { ...ZERO_SCORE },
      classification: "fallback",
    });
  }

  return candidates;
}
