// section 19 — Locator Reliability Score (weighted 0-100) and section 20 — Primary/Secondary/
// Fallback classification. Scoring runs *after* live validation (see session/liveValidate.ts),
// since the 30%-weighted Uniqueness component needs a real match count from the DOM — engine
// rule 6 ("always validate generated XPath") is what makes rule 10 ("don't recommend a locator
// solely because it's syntactically valid") enforceable here.

import { DEFAULT_STABILITY_SETTINGS, isTestIdAttribute } from "@/engine/stabilityConfig";
import type { LocatorCandidate, ScoreBreakdown, StabilitySettings, ValidationResult } from "@/types";

// Attribute-keyed candidates (id/name/role/placeholder/...) are ranked entirely by their
// position in settings.attributePriority (all configured test-id attributes collapse to tier
// 0, ahead of everything else) — this is the *only* place that ordering is consulted, so
// reordering it (or picking a different preset) in Settings actually changes ranking, not just
// what's displayed there. Structural candidate types that aren't keyed on a single attribute
// (text/axis/combination/absolute) get their own fixed tiers, kept in a numeric band above
// every possible attribute tier (MAX_ATTRIBUTE_TIER) so they can never collide with one —
// even the least-stable real attribute is still a more targeted signal than DOM position or
// traversal.
const MAX_ATTRIBUTE_TIER = 15;
const COMBINATION_TIER = 3;
const UNKNOWN_ATTRIBUTE_TIER = 12; // as weak as the least-preferred *recognized* attribute
const UNATTRIBUTED_STRUCTURAL_TIER = MAX_ATTRIBUTE_TIER + 1;
// Exact link text (Selenium's By.linkText) is just as strong/fragile a signal as an exact
// text()/normalize-space() match — it's the <a>-specific version of the same idea — and partial
// link text is the contains()-based sibling of that, exactly mirroring xpath-text's own
// exact-vs-contains() split. Both share TEXT_TIER rather than getting their own bands: this tier
// number also drives MAX_TIER below, and MAX_TIER shifts *every* attribute-keyed candidate's
// attributeStability score (see scoreAttributeStability) — a prior bug here was exactly this,
// a new structural tier nudging MAX_TIER just enough to flip a data-testid-vs-id tie (see the
// regression-guard test in scorer.test.ts). Link text and position candidates are differentiated
// from their tier-mates on domDependency/readability instead (below), not by inventing new tiers.
const TEXT_TIER = MAX_ATTRIBUTE_TIER + 2;
// section 17 "DOM relationship" — priority #10 of 11, deliberately low: an axis-based candidate
// (parent::/ancestor::/following::/etc.) is validated and usable, but structurally fragile by
// definition, so it's scored uniformly here regardless of which attribute (if any) it also
// keys on — a descendant::input[@name=...] candidate shouldn't outscore the plain
// //input[@name=...] form it's built on top of just because it happens to record the same
// attributeName.
const AXIS_TIER = MAX_ATTRIBUTE_TIER + 3;
// A wrapped-and-indexed candidate ( (expr)[N] ) is more fragile than an axis — any reordering
// or insertion in the matched list silently points it at a different element — but still
// meaningfully better than raw DOM position, since it's still keyed on a real attribute
// underneath. See INDEXED_TIER's use in captureElement.ts for when this actually gets generated
// (only as a last resort when nothing else validated as unique at all). position()/last() are
// pure DOM-order signals too (no attribute involved), so they share this tier as well.
const INDEXED_TIER = MAX_ATTRIBUTE_TIER + 4;
const ABSOLUTE_TIER = MAX_ATTRIBUTE_TIER + 5;
const MAX_TIER = ABSOLUTE_TIER;

/** The SelectorsHub-style full positional CSS path (engine/css.ts's generatePositionalCss) —
 * detected by shape rather than a dedicated LocatorType, since it's still exactly `type: "css"`
 * otherwise; only this generator ever emits a `:nth-of-type(` chain. */
export function isPositionalCss(candidate: LocatorCandidate): boolean {
  return candidate.type === "css" && candidate.value.includes(":nth-of-type(");
}

function attributeTier(candidate: LocatorCandidate, settings: StabilitySettings): number {
  if (candidate.type === "xpath-absolute" || isPositionalCss(candidate)) return ABSOLUTE_TIER;
  if (candidate.type === "xpath-indexed" || candidate.type === "xpath-position") return INDEXED_TIER;
  if (candidate.type === "xpath-axis") return AXIS_TIER;
  if (
    candidate.type === "xpath-text" ||
    candidate.type === "xpath-linktext" ||
    candidate.type === "xpath-partial-linktext"
  ) {
    return TEXT_TIER;
  }
  if (candidate.type === "xpath-combination" || !candidate.attributeName) {
    // css combination candidates also land here (no single attributeName recorded).
    return candidate.value.includes(" and ") || candidate.value.match(/\]\[/) ? COMBINATION_TIER : UNATTRIBUTED_STRUCTURAL_TIER;
  }
  if (isTestIdAttribute(candidate.attributeName, settings)) return 0;
  // Every configured test-id attribute is already accounted for by the check above, so
  // filtering them out here just recovers "position among the *other* attributes" — tier 0
  // stays exclusively reserved for test-ids regardless of where they happen to sit in the
  // underlying list.
  const rest = settings.attributePriority.filter((attr) => !isTestIdAttribute(attr, settings));
  const idx = rest.indexOf(candidate.attributeName);
  // Recognized-but-uncategorized attribute (custom data-*, `value`, `src`, ...) — mid-table
  // default rather than "unranked", so it doesn't get penalized as harshly as a structural
  // fallback just for not being in the configured list.
  return idx === -1 ? UNKNOWN_ATTRIBUTE_TIER : Math.min(idx + 1, MAX_ATTRIBUTE_TIER);
}

// Scored off the raw DOM match count — see ValidationResult.unique / validator.ts's
// toValidationResult for why visibility must not be allowed to mask real duplicates. Mirrors
// the same matchCount-based logic used for the `unique` flag, so a candidate's score and its
// unique badge never disagree.
function scoreUniqueness(validation: ValidationResult | undefined): number {
  if (!validation || !validation.valid) return 0;
  const count = validation.matchCount;
  if (count === 0) return 0;
  if (count === 1) return 30;
  return Math.max(2, Math.round(30 / count));
}

function scoreAttributeStability(candidate: LocatorCandidate, settings: StabilitySettings): number {
  const tier = attributeTier(candidate, settings);
  return Math.round(25 * (1 - tier / (MAX_TIER + 1)));
}

// Sibling axes are local (they can only ever match within the same parent) and so carry much
// less structural risk than following::/preceding:: (whole-document order — could latch onto
// an unrelated element far away in the DOM) or parent::/ancestor:: (break if a wrapper div gets
// added/removed). child:: sits in between: local, but position-indexed.
const AXIS_DOM_DEPENDENCY: Record<string, number> = {
  "following-sibling": 8,
  "preceding-sibling": 8,
  self: 8,
  child: 6,
  parent: 5,
  descendant: 5,
  ancestor: 3,
  following: 2,
  preceding: 2,
};

function scoreDomDependency(candidate: LocatorCandidate): number {
  if (isPositionalCss(candidate)) return 0;
  switch (candidate.type) {
    case "xpath-absolute":
      return 0;
    case "xpath-indexed":
      return 2; // still keyed on a real attribute, but position-dependent on top of that
    case "xpath-position":
      return 1; // pure DOM order, no attribute underneath at all — even more fragile than indexed
    case "xpath-axis":
      return candidate.axis ? (AXIS_DOM_DEPENDENCY[candidate.axis] ?? 4) : 4;
    case "xpath-id":
      return 15;
    case "css":
      return candidate.value.includes("[") && candidate.value.split("[").length > 2 ? 11 : 15;
    case "xpath-combination":
      return 11;
    case "xpath-text":
    case "xpath-linktext":
      return 9;
    case "xpath-partial-linktext":
      return 7;
    default:
      return 13;
  }
}

function scoreReadability(candidate: LocatorCandidate): number {
  let base: number;
  if (isPositionalCss(candidate)) {
    base = 2;
  } else {
    switch (candidate.type) {
      case "xpath-absolute":
        base = 2;
        break;
      case "xpath-indexed":
        base = 6; // still shows the underlying attribute predicate, just wrapped and indexed
        break;
      case "xpath-position":
        base = 7; // reads as plain XPath, unlike the opaque (expr)[N] wrapped form
        break;
      case "xpath-combination":
        base = 6;
        break;
      case "xpath-axis":
        base = 5;
        break;
      case "xpath-text":
      case "xpath-linktext":
        base = 8;
        break;
      case "xpath-partial-linktext":
        base = 6;
        break;
      default:
        base = 9;
    }
  }
  if (candidate.value.length > 60) base -= 1;
  if (candidate.value.length > 120) base -= 1;
  return Math.max(0, base);
}

function scoreLength(candidate: LocatorCandidate): number {
  const len = candidate.value.length;
  if (len <= 30) return 10;
  if (len <= 60) return 8;
  if (len <= 100) return 6;
  if (len <= 150) return 4;
  return 2;
}

function scoreDynamicRisk(candidate: LocatorCandidate): number {
  return candidate.usesDynamicAttribute ? 1 : 10;
}

export function scoreCandidate(
  candidate: LocatorCandidate,
  validation: ValidationResult | undefined,
  settings: StabilitySettings = DEFAULT_STABILITY_SETTINGS,
): ScoreBreakdown {
  const uniqueness = scoreUniqueness(validation);
  const attributeStability = scoreAttributeStability(candidate, settings);
  const domDependency = scoreDomDependency(candidate);
  const readability = scoreReadability(candidate);
  const length = scoreLength(candidate);
  const dynamicRisk = scoreDynamicRisk(candidate);
  const total = uniqueness + attributeStability + domDependency + readability + length + dynamicRisk;
  return { uniqueness, attributeStability, domDependency, readability, length, dynamicRisk, total };
}

/** Scores every candidate (mutating in place) using each one's already-attached validation. */
export function scoreAll(candidates: LocatorCandidate[], settings: StabilitySettings = DEFAULT_STABILITY_SETTINGS): void {
  for (const candidate of candidates) {
    candidate.score = scoreCandidate(candidate, candidate.validation, settings);
  }
}

const MAX_SECONDARY = 2;
// Candidates keyed on an attribute at or above this stability tier (test-id/aria/id/name/role,
// plus type+name-style combinations) are eligible for Primary/Secondary. Weaker signals — class,
// text, DOM-relationship, absolute position — can still validate as unique, but per the doc's
// own worked example (section 20: text-based candidate is Fallback despite being unique) they
// stay Fallback on their own merits, not just because something else outranked them.
const SECONDARY_ELIGIBLE_MAX_TIER = 5;

/**
 * section 20 — classifies by score (highest first), reserving Primary/Secondary for ones
 * validation confirmed are unique, and preferring a strong attribute among those. Uniqueness is
 * treated as a hard gate ahead of everything else: a non-unique locator doesn't reliably locate
 * the element at all (it'll throw "multiple elements found" or silently grab the wrong one in a
 * real test), so it must never outrank a unique one for Primary/Secondary just because it scored
 * higher on attribute stability — that was a real bug here previously (a non-unique
 * `a[title="..."]` won Primary over two validated-unique text() candidates simply because
 * nothing unique also happened to be low-tier, and the old fallback picked the single highest
 * raw score with no regard for uniqueness at all). Only when *nothing* validated as unique does
 * this fall back to the best-scoring candidate overall (acceptance scenario 4 requires *a*
 * recommendation), and even then its non-unique validation badge stays visible in the UI, so a
 * weak recommendation is never silently dressed up as a strong one.
 */
export function classifyCandidates(
  candidates: LocatorCandidate[],
  settings: StabilitySettings = DEFAULT_STABILITY_SETTINGS,
): void {
  for (const candidate of candidates) candidate.classification = "fallback";

  const sorted = [...candidates].sort((a, b) => b.score.total - a.score.total);
  const uniqueCandidates = sorted.filter((c) => c.validation?.unique);
  // Rank exclusively within the unique pool when one exists — a non-unique candidate is never
  // eligible for Primary/Secondary while even one unique candidate is available, regardless of
  // its own score.
  const pool = uniqueCandidates.length > 0 ? uniqueCandidates : sorted;

  let primaryAssigned = false;
  let secondaryCount = 0;

  for (const candidate of pool) {
    const isEligible = attributeTier(candidate, settings) <= SECONDARY_ELIGIBLE_MAX_TIER;
    if (!primaryAssigned && isEligible) {
      candidate.classification = "primary";
      primaryAssigned = true;
    } else if (primaryAssigned && isEligible && secondaryCount < MAX_SECONDARY) {
      candidate.classification = "secondary";
      secondaryCount += 1;
    }
  }

  if (!primaryAssigned && pool.length > 0) {
    pool[0].classification = "primary";
  }
}
