// Core domain types shared by the engine, session layer, and UI.
// Field names track the doc's "Locator Metadata" (section 38) and "Sample Internal Data
// Model" (section 72) as closely as makes sense for the MVP (Phase 1) scope.

export type XPathCandidateType =
  | "xpath-absolute"
  | "xpath-id"
  | "xpath-name"
  | "xpath-class"
  | "xpath-attribute"
  | "xpath-combination"
  | "xpath-text"
  | "xpath-axis"
  | "xpath-indexed"
  // section 21 — Link Text / Partial Link Text (Selenium's By.linkText/By.partialLinkText),
  // only ever produced for <a> tags — see engine/xpath/linkText.ts.
  | "xpath-linktext"
  | "xpath-partial-linktext"
  // section 15 — position()/last(), a more readable native alternative to the (expr)[N]
  // indexed fallback — see engine/xpath/position.ts.
  | "xpath-position";

export type LocatorType = XPathCandidateType | "css";

// section 13's supported axes — @attr (attribute::) is covered by every attribute-based
// candidate already, and ancestor-or-self/descendant-or-self/namespace aren't surfaced as
// distinct candidates since real-world locators essentially never use them directly.
export type XPathAxis =
  | "parent"
  | "ancestor"
  | "child"
  | "descendant"
  | "following"
  | "following-sibling"
  | "preceding"
  | "preceding-sibling"
  | "self";

export type LocatorClassification = "primary" | "secondary" | "fallback";

export interface ScoreBreakdown {
  uniqueness: number; // out of 30
  attributeStability: number; // out of 25
  domDependency: number; // out of 15
  readability: number; // out of 10
  length: number; // out of 10
  dynamicRisk: number; // out of 10
  total: number; // out of 100
}

export interface ValidationResult {
  valid: boolean;
  /** Total DOM matches, regardless of visibility — kept for transparency (shown in the UI). */
  matchCount: number;
  /** Matches that are actually visible/rendered (nonzero size, not display:none/visibility:
   * hidden/opacity:0, not display:none via an ancestor). Informational only — shown in the UI
   * alongside `matchCount` to help explain *why* a locator isn't unique (e.g. "1 visible (4 in
   * DOM)"). Deliberately NOT used to compute `unique`: a locator that resolves to several real
   * DOM elements isn't safe to recommend just because some of them are currently hidden —
   * Playwright's strict mode throws on exactly that, and Selenium silently grabs whichever
   * match happens to be first. */
  visibleMatchCount: number;
  /** valid && matchCount === 1 — the "usable" gate scoring/classification use. */
  unique: boolean;
  executionTimeMs: number;
  error?: string;
  checkedAt: string;
}

export interface LocatorCandidate {
  id: string;
  type: LocatorType;
  value: string;
  usesDynamicAttribute: boolean;
  attributeName?: string;
  /** Set only for type: "xpath-axis" — which axis this candidate uses. */
  axis?: XPathAxis;
  score: ScoreBreakdown;
  classification: LocatorClassification;
  validation?: ValidationResult;
}

export type ElementAttributes = Record<string, string>;

export type LimitedContext = "cross-origin-iframe" | "closed-shadow-root" | null;

export interface AncestorSegment {
  tag: string;
  /** 1-based position among same-tag siblings under the same parent. */
  index: number;
}

/** A lightweight description of a nearby element — enough to build an axis-step predicate
 * from, without carrying a full ElementSnapshot for it. */
export interface AnchorElement {
  tag: string;
  text: string;
  attributes: ElementAttributes;
  /** Whether this anchor's own best identifying signal (id/test-id/name/notable attribute/
   * class/text — checked live against the page, same priority engine/xpath/util.ts's
   * bestPredicateFor() uses) matches exactly one element on the page. The whole point of an
   * axis-based locator is to reach a target *by way of* a reliable reference point — an axis
   * generator built on a non-unique anchor (e.g. a "Username" label repeated across table rows)
   * produces a locator that inherits that non-uniqueness, so every axis generator in
   * engine/xpath/axes/ requires this to be true before using an anchor. */
  isUnique: boolean;
}

export interface LabelAnchor {
  element: AnchorElement;
  /** label.parentElement === target.parentElement */
  sharesParent: boolean;
  /** label.parentElement contains target (true whenever sharesParent is true too) */
  parentContains: boolean;
  /** Where the target sits relative to the label in document order. */
  documentOrder: "before" | "after";
}

export interface LandmarkAncestor {
  element: AnchorElement;
  /** How many levels above the target's parent this ancestor was found. */
  depth: number;
}

export interface SiblingAnchors {
  previous: AnchorElement | null;
  next: AnchorElement | null;
}

/**
 * A page-duplicated ancestor (its own best predicate matches several elements — e.g. every tab
 * of a repeated search widget) that a real DOM/accessibility *state* attribute distinguishes
 * from its duplicates — `hidden`, `aria-hidden`, `aria-selected`, `aria-expanded`, a
 * `tabindex="-1"` convention, or a semantic class token (`active`/`selected`/...). Unlike
 * `LandmarkAncestor`, `element.isUnique` here is expected to be false on its own — the
 * disambiguating power comes from combining it with `statePredicate`, and
 * electron/webview-preload.cjs's resolveStateAnchor() only ever returns one after verifying
 * live that base-predicate-AND-statePredicate together match exactly one element. Because the
 * state condition becomes part of the XPath predicate itself rather than a separate visibility
 * check, the result is exactly as real to Playwright/Selenium as any other attribute-based
 * locator — see engine/validator.ts for why that distinction matters — and it survives DOM
 * reordering the way indexed disambiguation ((expr)[N]) cannot.
 */
export interface StateAnchor {
  element: AnchorElement;
  /** How many levels above the target's parent this ancestor was found. */
  depth: number;
  /** Extra XPath predicate fragment, e.g. "not(@hidden)" or "@aria-selected='true'" — combined
   * with `bestPredicateFor(element)` via "and" to form the anchor step's full predicate. */
  statePredicate: string;
}

export interface ElementSnapshot {
  tag: string;
  text: string;
  innerText: string;
  outerHtml: string;
  attributes: ElementAttributes;
  classList: string[];
  parentTag: string | null;
  parentAttributes: ElementAttributes | null;
  siblingIndex: number;
  siblingCount: number;
  /** Count of the parent's children sharing this element's own tag name (unlike siblingCount,
   * which counts every child regardless of tag) — the value XPath's position()/last() actually
   * operate over for a `tag[position()=N]`/`tag[last()]` step. See engine/xpath/position.ts. */
  tagSiblingCount: number;
  childTags: string[];
  domDepth: number;
  nearbyLabelText: string | null;
  ancestorChain: AncestorSegment[];
  isSensitive: boolean;
  limitedContext: LimitedContext;
  pageUrl: string;
  pageTitle: string;
  /** section 14 "Smart XPath Generation" context — populated only when found; most elements
   * won't have a landmark ancestor or sibling anchors, and that's expected. */
  labelAnchor: LabelAnchor | null;
  landmarkAncestor: LandmarkAncestor | null;
  siblingAnchors: SiblingAnchors;
  /** Populated only when no ordinary unique landmark ancestor was found nearby — see
   * StateAnchor for what this covers that LandmarkAncestor can't. */
  stateAnchor: StateAnchor | null;
  /** The immediate parent <iframe>'s `src` attribute, when this element was captured inside a
   * same-origin frame — null for the top-level document. `webview.executeJavaScript()` only ever
   * runs against the webview's *top* document, so every live-validation script needs this to
   * find its way into the right iframe's own document before querying — see
   * engine/validator.ts's buildValidationScript/buildIndexScript for where that actually
   * happens. Only tracks one level of nesting (matches what capture itself records); a locator
   * captured inside a frame-within-a-frame isn't live-validatable today. */
  frameSrc: string | null;
  /** The top-level page's rendered viewport size at capture time (`window.innerWidth/Height`) —
   * reflects whatever device/resolution emulation (see src/devicePresets.ts) was active, so a
   * locator captured only inside a mobile layout can be told apart from one captured at desktop
   * width. Always measurable, so not nullable — a capture always has *some* viewport. */
  viewportWidth: number;
  viewportHeight: number;
}

export interface CapturedElement {
  id: string;
  name: string;
  snapshot: ElementSnapshot;
  candidates: LocatorCandidate[];
  primaryLocatorId: string | null;
  capturedAt: string;
  updatedAt: string;
  version: number;
}

export interface CaptureSession {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  baseUrl: string;
  currentUrl: string;
  elements: CapturedElement[];
}

// Not user-configurable — see engine/stabilityConfig.ts's DEFAULT_STABILITY_SETTINGS, the single
// fixed ranking every generator/scorer uses. Kept as its own type only because it's threaded
// through several engine function signatures as an implementation seam for tests.
export interface StabilitySettings {
  /** Ordered, most-stable first — mirrors section 17's default priority. */
  attributePriority: string[];
  testIdAttributes: string[];
}
