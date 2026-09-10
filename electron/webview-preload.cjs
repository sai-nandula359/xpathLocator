/**
 * Preload script injected into the <webview>'s guest page (the site being browsed), via the
 * webview tag's own `preload` attribute — distinct from electron/preload.cjs, which preloads
 * the *host* window. Electron re-runs this on every navigation inside the webview, including
 * SPA route changes, so it doesn't need to be re-attached manually.
 *
 * Responsibilities (sections 8, 9, 36, 37, 57, 59):
 *  - hover highlight overlay
 *  - Ctrl+Click capture, without disturbing normal clicks
 *  - never read the value of a password/sensitive-looking field
 *  - best-effort same-origin iframe support; a one-time notice (not a silent failure) for
 *    cross-origin iframes this script structurally cannot see inside
 */

const { ipcRenderer } = require("electron");

const HIGHLIGHT_ID = "__slcs_highlight_overlay__";
const SENSITIVE_NAME_RE = /card|credit|cvv|cvc|ssn|social.?security|passport|secret|token/i;

function ensureHighlightEl(doc) {
  let el = doc.getElementById(HIGHLIGHT_ID);
  if (el) return el;
  el = doc.createElement("div");
  el.id = HIGHLIGHT_ID;
  el.style.cssText = [
    "position: fixed",
    "pointer-events: none",
    "z-index: 2147483647",
    "border: 2px solid #3b82f6",
    "background: rgba(59, 130, 246, 0.12)",
    "border-radius: 2px",
    "box-shadow: 0 0 0 1px rgba(255,255,255,0.6)",
    "transition: none",
    "display: none",
  ].join(";");
  const label = doc.createElement("div");
  label.className = "__slcs_highlight_label__";
  label.style.cssText = [
    "position: absolute",
    "top: -22px",
    "left: -2px",
    "background: #3b82f6",
    "color: white",
    "font: 11px/1.4 -apple-system, sans-serif",
    "padding: 1px 6px",
    "border-radius: 3px",
    "white-space: nowrap",
  ].join(";");
  el.appendChild(label);
  doc.documentElement.appendChild(el);
  return el;
}

function describeForLabel(el) {
  const bits = [el.tagName.toLowerCase()];
  if (el.id) bits.push(`#${el.id}`);
  else if (el.getAttribute("name")) bits.push(`[name="${el.getAttribute("name")}"]`);
  else {
    const key = el.getAttribute("data-testid") || el.getAttribute("aria-label");
    if (key) bits.push(`[${key}]`);
  }
  return bits.join("");
}

function positionHighlight(doc, el) {
  const overlay = ensureHighlightEl(doc);
  const rect = el.getBoundingClientRect();
  overlay.style.display = "block";
  overlay.style.top = `${rect.top}px`;
  overlay.style.left = `${rect.left}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  overlay.querySelector(".__slcs_highlight_label__").textContent = describeForLabel(el);
}

function hideHighlight(doc) {
  const overlay = doc.getElementById(HIGHLIGHT_ID);
  if (overlay) overlay.style.display = "none";
}

function isSensitiveField(el, attrs) {
  if ((attrs.type || "").toLowerCase() === "password") return true;
  const probe = `${attrs.name || ""} ${attrs.id || ""} ${attrs.placeholder || ""} ${attrs["aria-label"] || ""}`;
  return SENSITIVE_NAME_RE.test(probe);
}

function collectAttributes(el) {
  const attrs = {};
  for (const attr of Array.from(el.attributes)) {
    attrs[attr.name] = attr.value;
  }
  return attrs;
}

function ancestorChainFor(el) {
  const chain = [];
  let node = el;
  while (node) {
    const tag = node.tagName.toLowerCase();
    let index = 1;
    if (node.parentElement) {
      const siblings = Array.from(node.parentElement.children).filter(
        (c) => c.tagName === node.tagName,
      );
      index = siblings.indexOf(node) + 1;
    }
    chain.unshift({ tag, index });
    node = node.parentElement;
  }
  return chain;
}

// Tags that describe *themselves* rather than something else nearby — never useful as a text
// anchor for a sibling element (e.g. a preceding <button> isn't "labelling" the input next to
// it the way a <span>/<div> of descriptive text is).
const NON_ANCHOR_TAGS = new Set([
  "INPUT",
  "SELECT",
  "TEXTAREA",
  "BUTTON",
  "A",
  "IFRAME",
  "IMG",
  "SVG",
  "SCRIPT",
  "STYLE",
  "LABEL",
]);
const MAX_GENERIC_ANCHOR_TEXT = 80;

// Resolves the element (not just its text) that best describes `el` for a real screen reader
// *and* for the doc's own axis examples — section 14 anchors on a plain <span> ("Username"),
// not necessarily a semantic <label>, which most component-library/modern-web markup doesn't
// use at all. Tries, in order: explicit for=, aria-labelledby, a wrapping <label>, a preceding
// <label> sibling, then — the broadest and most impactful case in practice — *any* preceding
// sibling that's plainly descriptive text rather than another control. Returns the DOM node
// itself (not just its text) so callers can inspect its structural relationship to `el`.
function resolveLabelElement(doc, el, attrs) {
  if (attrs.id) {
    const forLabel = doc.querySelector(`label[for="${CSS.escape(attrs.id)}"]`);
    if (forLabel && forLabel.textContent.trim()) return forLabel;
  }
  if (attrs["aria-labelledby"]) {
    const id = attrs["aria-labelledby"].split(/\s+/)[0];
    const node = id && doc.getElementById(id);
    if (node && node.textContent.trim()) return node;
  }
  const wrappingLabel = el.closest("label");
  if (wrappingLabel && wrappingLabel.textContent.trim()) return wrappingLabel;
  let sib = el.previousElementSibling;
  while (sib) {
    if (sib.tagName === "LABEL" && sib.textContent.trim()) return sib;
    sib = sib.previousElementSibling;
  }
  // The generic fallback only looks at the *immediate* previous sibling, and only when that
  // sibling holds no interactive controls of its own — otherwise it's a container for some
  // other, unrelated field/section (e.g. a preceding form-group wrapping a different input),
  // not a label for `el`, and treating it as one produces a wrong-but-plausible-looking anchor
  // (this is exactly how a previous version of this function mis-anchored a submit button on an
  // unrelated preceding field's wrapper div and named it after that field instead).
  const immediate = el.previousElementSibling;
  if (immediate && !NON_ANCHOR_TAGS.has(immediate.tagName) && !immediate.querySelector("input, select, textarea, button, a, iframe")) {
    const text = immediate.textContent.trim();
    if (text && text.length <= MAX_GENERIC_ANCHOR_TEXT) return immediate;
  }
  return null;
}

const MAX_ANCESTOR_TEXT = 200;
const TEST_ID_ATTRS = ["data-testid", "data-test", "data-test-id", "data-qa", "data-cy", "data-automation-id", "data-automation", "data-e2e"];
const NOTABLE_ANCHOR_ATTRS = ["aria-label", "role", "placeholder", "title", "href", "alt", "type"];

// Mirrors engine/xpath/util.ts's bestPredicateFor() priority (id > test-id > name > notable
// attrs > class > text) but checked *live* against the page, to answer a different question:
// not "what's the best predicate for this element" but "would that predicate actually match
// only this element" — the anchor uniqueness check every axis generator depends on (see
// AnchorElement.isUnique in src/types.ts for why). Defaults to false (i.e. don't trust this
// anchor) on any query failure, since an axis built on an anchor we're unsure about is worse
// than not offering one.
function isLikelyUniqueAnchor(doc, el) {
  try {
    const attrs = collectAttributes(el);
    if (attrs.id) return doc.querySelectorAll(`#${CSS.escape(attrs.id)}`).length === 1;
    for (const attr of TEST_ID_ATTRS) {
      if (attrs[attr]) return doc.querySelectorAll(`[${attr}="${CSS.escape(attrs[attr])}"]`).length === 1;
    }
    if (attrs.name) return doc.querySelectorAll(`[name="${CSS.escape(attrs.name)}"]`).length === 1;
    for (const attr of NOTABLE_ANCHOR_ATTRS) {
      if (attrs[attr]) return doc.querySelectorAll(`[${attr}="${CSS.escape(attrs[attr])}"]`).length === 1;
    }
    if (el.classList.length > 0) {
      return doc.getElementsByClassName(el.classList[0]).length === 1;
    }
    const text = (el.textContent || "").trim();
    if (text) {
      const sameTag = Array.from(doc.getElementsByTagName(el.tagName));
      return sameTag.filter((n) => (n.textContent || "").trim() === text).length === 1;
    }
  } catch {
    // malformed attribute value for a selector, etc. — fall through to "not trusted"
  }
  return false;
}

function describeElement(doc, el) {
  if (!el) return null;
  return {
    tag: el.tagName.toLowerCase(),
    text: (el.textContent || "").trim().slice(0, MAX_ANCESTOR_TEXT),
    attributes: collectAttributes(el),
    isUnique: isLikelyUniqueAnchor(doc, el),
  };
}

// section 14 "Smart XPath Generation" — the structural facts the axis generators
// (src/engine/xpath/axes/*) need, computed once here rather than re-derived from a live DOM
// each has no access to.
function resolveLabelAnchor(doc, el, attrs) {
  const label = resolveLabelElement(doc, el, attrs);
  if (!label) return null;
  const position = label.compareDocumentPosition(el);
  return {
    element: describeElement(doc, label),
    sharesParent: label.parentElement === el.parentElement,
    parentContains: !!label.parentElement && label.parentElement !== el && label.parentElement.contains(el),
    // eslint-disable-next-line no-bitwise
    documentOrder: position & Node.DOCUMENT_POSITION_FOLLOWING ? "before" : "after",
  };
}

const LANDMARK_CLASS_RE = /group|container|field|row|section|card|form|wrapper|panel/i;
// Real component-library markup (React/Vue design systems in particular) routinely nests a
// dozen-plus wrapper divs between a form control and the nearest ancestor that's actually
// page-unique — confirmed live on a real production site, where the location search input's
// nearest *landmark-shaped* ancestor (an "...__input-wrapper" div) sits at depth 0 but is
// duplicated 4x, while the nearest one that's both landmark-shaped AND genuinely unique (a
// ".w-booking-widget-container" wrapper, not a dynamically-generated id) doesn't appear until
// depth 13. A shallow cap here doesn't just miss a nice-to-have optimization — it silently
// starves every landmark-dependent axis generator (descendant/ancestor/child) of an anchor on
// exactly the pages (deeply-nested, duplicated widgets) where an axis-based locator matters most,
// forcing a fall back to indexed disambiguation even when a perfectly good attribute-based one
// was available a few levels further up.
const MAX_LANDMARK_DEPTH = 20;

function looksLikeLandmark(el) {
  if (el.id) return true;
  if (el.tagName === "FORM" || el.tagName === "SECTION" || el.tagName === "MAIN") return true;
  for (const attr of Array.from(el.attributes)) {
    if (/^data-(testid|test|qa|cy|automation|e2e)/i.test(attr.name)) return true;
  }
  return Array.from(el.classList).some((c) => LANDMARK_CLASS_RE.test(c));
}

// Mirrors engine/dynamicAttributeDetector.ts's "embedded framework token" check (React's
// useId() colon-wrapped token in particular, e.g. "tabs-:rm:-mobile-booking-widget-modal-
// tabpanel-0" — confirmed live on a real production site) — used only to prefer a *stable*-
// looking unique landmark over a merely-nearer dynamic-looking one below; a dynamic-looking one
// is still kept as a fallback (it's a real, currently-unique anchor, just a riskier one — the
// resulting candidate's usesDynamicAttribute flag correctly reflects that downstream either way).
const LANDMARK_ID_LOOKS_DYNAMIC_RE = /:r[0-9a-z]+:|\bradix-[a-z0-9-]+\b|\bmui-\d+\b/i;

function landmarkIdentifierLooksDynamic(el) {
  return !!el.id && LANDMARK_ID_LOOKS_DYNAMIC_RE.test(el.id);
}

// Climbs past a landmark-*shaped* ancestor that isn't actually unique (e.g. a wrapper div class
// shared by every duplicate copy of a widget) to keep looking for one that both looks like a
// landmark AND is live-verified unique — preferring the nearest *stable*-looking one that
// satisfies both, falling back to a dynamic-looking-but-unique one, and only falling back further
// to the nearest landmark-shaped ancestor regardless of uniqueness if nothing in the whole search
// matched both (preserves the old behavior for elements with no unique ancestor at all, so
// downstream axis generators still see *some* landmark to report as non-unique, same as before
// this fix).
function resolveLandmarkAncestor(doc, el) {
  let node = el.parentElement;
  let depth = 0;
  let nearestShapeMatch = null;
  let firstUniqueButDynamic = null;
  while (node && depth < MAX_LANDMARK_DEPTH) {
    if (looksLikeLandmark(node)) {
      const described = describeElement(doc, node);
      if (!nearestShapeMatch) nearestShapeMatch = { element: described, depth };
      if (described.isUnique) {
        if (!landmarkIdentifierLooksDynamic(node)) return { element: described, depth };
        if (!firstUniqueButDynamic) firstUniqueButDynamic = { element: described, depth };
      }
    }
    node = node.parentElement;
    depth += 1;
  }
  return firstUniqueButDynamic || nearestShapeMatch;
}

function cssAttrEscape(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// Mirrors engine/xpath/util.ts's bestPredicateFor() attribute priority (id > test-id > name >
// notable attrs > class) as a CSS *test* selector rather than an XPath predicate string — used
// only to check *uniqueness* live here; the engine independently recomputes the matching XPath
// predicate from the same attributes via bestPredicateFor(), so this order must stay in sync
// with it (same convention as isLikelyUniqueAnchor above).
function bestBaseSelector(el) {
  const attrs = collectAttributes(el);
  if (attrs.id) return `#${CSS.escape(attrs.id)}`;
  for (const attr of TEST_ID_ATTRS) {
    if (attrs[attr]) return `[${attr}="${cssAttrEscape(attrs[attr])}"]`;
  }
  if (attrs.name) return `[name="${cssAttrEscape(attrs.name)}"]`;
  for (const attr of NOTABLE_ANCHOR_ATTRS) {
    if (attrs[attr]) return `[${attr}="${cssAttrEscape(attrs[attr])}"]`;
  }
  if (el.classList.length > 0) return `.${CSS.escape(el.classList[0])}`;
  return null;
}

// Semantic state-ish class tokens only — never blindly trusts an arbitrary class that happens to
// differ, since that's just as likely to be an unrelated per-instance utility class as a real
// state marker.
const STATE_CLASS_TOKEN_RE = /^is-(active|open|selected|current|expanded|visible)$|^(active|selected|current|open|expanded|visible|shown)$/i;

// Compares `node` against the other elements sharing its base predicate (the "duplicate group")
// to find a genuine DOM/accessibility state attribute that `node` alone has (or alone lacks)
// among the group. Every candidate here becomes part of the final XPath predicate itself, so
// it's exactly as real to Playwright/Selenium as any other attribute-based locator — not a
// private "looks visible to us" overlay (see engine/validator.ts for why that distinction
// matters after the id="location" regression).
function findStatePredicate(node, group) {
  const others = group.filter((n) => n !== node);
  if (others.length === 0) return null;

  if (!node.hasAttribute("hidden") && others.every((n) => n.hasAttribute("hidden"))) {
    return { css: ":not([hidden])", xpath: "not(@hidden)" };
  }
  const ariaHidden = node.getAttribute("aria-hidden");
  if (ariaHidden !== "true" && others.every((n) => n.getAttribute("aria-hidden") === "true")) {
    return { css: ':not([aria-hidden="true"])', xpath: "not(@aria-hidden='true')" };
  }
  const ariaSelected = node.getAttribute("aria-selected");
  if (ariaSelected === "true" && others.every((n) => n.getAttribute("aria-selected") !== "true")) {
    return { css: '[aria-selected="true"]', xpath: "@aria-selected='true'" };
  }
  const ariaExpanded = node.getAttribute("aria-expanded");
  if (ariaExpanded === "true" && others.every((n) => n.getAttribute("aria-expanded") !== "true")) {
    return { css: '[aria-expanded="true"]', xpath: "@aria-expanded='true'" };
  }
  const tabindex = node.getAttribute("tabindex");
  if (tabindex !== "-1" && others.every((n) => n.getAttribute("tabindex") === "-1")) {
    return { css: ':not([tabindex="-1"])', xpath: "not(@tabindex='-1')" };
  }

  const nodeClasses = Array.from(node.classList);
  const otherClassSets = others.map((n) => new Set(n.classList));
  for (const token of nodeClasses) {
    if (!STATE_CLASS_TOKEN_RE.test(token)) continue;
    if (otherClassSets.every((s) => !s.has(token))) {
      return {
        css: `.${CSS.escape(token)}`,
        xpath: `contains(concat(' ', normalize-space(@class), ' '), ' ${token} ')`,
      };
    }
  }
  const otherTokens = new Set();
  for (const s of otherClassSets) for (const t of s) otherTokens.add(t);
  for (const token of otherTokens) {
    if (!STATE_CLASS_TOKEN_RE.test(token) || nodeClasses.includes(token)) continue;
    if (otherClassSets.every((s) => s.has(token))) {
      return {
        css: `:not(.${CSS.escape(token)})`,
        xpath: `not(contains(concat(' ', normalize-space(@class), ' '), ' ${token} '))`,
      };
    }
  }
  return null;
}

const MAX_STATE_ANCHOR_DEPTH = 20; // matches MAX_LANDMARK_DEPTH — see its comment for why 20

// Walks upward from `el` looking for an ancestor whose ordinary best predicate matches several
// elements (a duplicated widget copy — resolveLandmarkAncestor's isUnique check would reject it)
// but where a real state attribute narrows that same predicate down to exactly this one,
// live-verified. Only invoked when the ordinary landmark search didn't already find a genuinely
// unique ancestor (see buildSnapshot below) — this specifically covers pages where a whole
// widget is duplicated (once per tab, per breakpoint, ...) and no ordinary predicate at any
// depth is unique on its own.
function resolveStateAnchor(doc, el) {
  let node = el.parentElement;
  let depth = 0;
  while (node && depth < MAX_STATE_ANCHOR_DEPTH) {
    const baseSelector = bestBaseSelector(node);
    if (baseSelector) {
      let group = [];
      try {
        group = Array.from(doc.querySelectorAll(baseSelector));
      } catch {
        group = [];
      }
      if (group.length > 1 && group.includes(node)) {
        const state = findStatePredicate(node, group);
        if (state) {
          try {
            if (doc.querySelectorAll(baseSelector + state.css).length === 1) {
              return { element: describeElement(doc, node), depth, statePredicate: state.xpath };
            }
          } catch {
            // combined selector was invalid CSS (shouldn't normally happen) — keep climbing
          }
        }
      }
    }
    node = node.parentElement;
    depth += 1;
  }
  return null;
}

// A sibling that itself wraps interactive controls is a container for some other field/section,
// not a meaningful anchor for `el` — and a sibling that IS itself an interactive control (a
// clear/close/toggle button next to an input, say) isn't "labelling" el any more than that
// button labels anything (same NON_ANCHOR_TAGS reasoning resolveLabelElement's generic fallback
// already uses for exactly this). This matters more here than it looks: a button like that is
// often only present in the DOM while some transient UI state is active (an autocomplete's
// "Close dropdown" button that only exists while its dropdown is open) — it can look genuinely
// page-unique at the moment of capture, precisely because only one instance of a repeated widget
// happens to be in that transient state right then, but the button (and the anchor built on it)
// won't exist at all once that state ends — which for most automated tests is *before* the test
// ever interacts with the page. Confirmed live: capturing a duplicated site's location input
// while its autocomplete dropdown was open produced a locator anchored on that dropdown's own
// "Close dropdown" button, which would find zero matches against the page's normal, closed state.
function describeSiblingAnchor(doc, el) {
  if (!el || NON_ANCHOR_TAGS.has(el.tagName) || el.querySelector("input, select, textarea, button, a, iframe")) {
    return null;
  }
  return describeElement(doc, el);
}

function resolveSiblingAnchors(doc, el) {
  return {
    previous: describeSiblingAnchor(doc, el.previousElementSibling),
    next: describeSiblingAnchor(doc, el.nextElementSibling),
  };
}

function looksLikeClosedShadowHost(el) {
  return el.tagName.includes("-") && el.shadowRoot === null && el.children.length === 0;
}

function buildSnapshot(doc, el, frameSrc) {
  const attrs = collectAttributes(el);
  const isSensitive = isSensitiveField(el, attrs);
  if (isSensitive) delete attrs.value; // section 57 — never capture a secret value
  const parent = el.parentElement;
  const siblings = parent ? Array.from(parent.children) : [el];

  const landmarkAncestor = resolveLandmarkAncestor(doc, el);
  // Only bother searching for a state-disambiguated anchor when the ordinary landmark search
  // didn't already find a genuinely unique one — the common case, and the state-anchor walk
  // costs several querySelectorAll calls per ancestor level.
  const stateAnchor = !landmarkAncestor || !landmarkAncestor.element.isUnique ? resolveStateAnchor(doc, el) : null;

  let limitedContext = null;
  if (looksLikeClosedShadowHost(el)) limitedContext = "closed-shadow-root";

  // el.outerHTML reflects the *attribute* markup, independently of the `attrs` object above —
  // for a sensitive field with a literal value="..." in the markup (a pre-filled password, a
  // leaked token) that value would otherwise round-trip straight into outerHtml even though it
  // was already stripped from `attrs`. Serialize a clone with the attribute removed instead.
  let outerHtml = el.outerHTML;
  if (isSensitive) {
    const clone = el.cloneNode(false);
    clone.removeAttribute("value");
    outerHtml = clone.outerHTML;
  }

  return {
    tag: el.tagName.toLowerCase(),
    text: Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent)
      .join("")
      .trim(),
    innerText: (el.innerText ?? el.textContent ?? "").trim(),
    outerHtml: outerHtml.slice(0, 4000),
    attributes: attrs,
    classList: Array.from(el.classList),
    parentTag: parent ? parent.tagName.toLowerCase() : null,
    parentAttributes: parent ? collectAttributes(parent) : null,
    siblingIndex: siblings.indexOf(el),
    siblingCount: siblings.length,
    childTags: Array.from(el.children).map((c) => c.tagName.toLowerCase()),
    domDepth: ancestorChainFor(el).length,
    nearbyLabelText: resolveLabelElement(doc, el, attrs)?.textContent.trim() || null,
    ancestorChain: ancestorChainFor(el),
    isSensitive,
    limitedContext,
    // Human-readable — the frame suffix is just for display in the UI (Locator Details' page-url
    // line). frameSrc below is the structured form the live-validation pipeline actually uses to
    // find the right <iframe> to query inside.
    pageUrl: frameSrc ? `${doc.location.href} (frame: ${frameSrc})` : doc.location.href,
    pageTitle: doc.title,
    labelAnchor: resolveLabelAnchor(doc, el, attrs),
    landmarkAncestor,
    siblingAnchors: resolveSiblingAnchors(doc, el),
    stateAnchor,
    frameSrc: frameSrc || null,
    // The top-level page's own rendered viewport (not the iframe's, when capturing inside one) —
    // this is exactly what device emulation resizes, so it doubles as a record of which
    // device/resolution (if any) was active at capture time.
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
}

// section 55 — capture mode is a toggle (Ctrl+Shift+C / Esc), not always-on; the host pushes
// its current value down after every navigation, since this whole script re-runs then.
let captureModeEnabled = true;

// Cross-origin frames found anywhere on the page, accumulated for the life of this navigation
// and re-sent in full each time a new one turns up — the host's own handler
// (useWebviewCapture.ts's onIpc) replaces its list wholesale on every "frame-notice" rather than
// merging, so this side has to keep the running total instead.
const reportedCrossOriginFrames = new Set();

function reportCrossOriginFrame(label) {
  if (reportedCrossOriginFrames.has(label)) return;
  reportedCrossOriginFrames.add(label);
  ipcRenderer.sendToHost("frame-notice", { crossOriginFrames: Array.from(reportedCrossOriginFrames) });
}

// Documents already wired up — attachCaptureListeners can be asked to attach the same document
// twice (setupFrame below tries once immediately *and* again on the frame's 'load' event, since
// either one might be the point where the content is actually ready), and without this guard
// that would double up every listener, firing each capture twice.
const attachedDocuments = new WeakSet();

function attachCaptureListeners(doc, frameLabel) {
  if (attachedDocuments.has(doc)) return;
  attachedDocuments.add(doc);

  doc.addEventListener(
    "mouseover",
    (event) => {
      if (!captureModeEnabled) return;
      const target = event.composedPath ? event.composedPath()[0] : event.target;
      if (!(target instanceof doc.defaultView.Element)) return;
      if (target.id === HIGHLIGHT_ID) return;
      positionHighlight(doc, target);
    },
    true,
  );

  doc.addEventListener(
    "mouseout",
    () => {
      hideHighlight(doc);
    },
    true,
  );

  doc.addEventListener(
    "click",
    (event) => {
      if (!captureModeEnabled || !event.ctrlKey) return; // normal click — site behaves normally (section 8/55)
      event.preventDefault();
      event.stopPropagation();
      const target = event.composedPath ? event.composedPath()[0] : event.target;
      if (!(target instanceof doc.defaultView.Element)) return;
      const snapshot = buildSnapshot(doc, target, frameLabel);
      ipcRenderer.sendToHost("element-captured", snapshot);
    },
    true,
  );

  doc.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && captureModeEnabled) {
        ipcRenderer.sendToHost("exit-capture-mode");
      } else if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        ipcRenderer.sendToHost("toggle-capture-mode");
      }
    },
    true,
  );
}

const MAX_FRAME_DEPTH = 8;

// Wires up one <iframe> element for capture. Tries immediately (covers a frame that's already
// finished loading by the time this runs) AND again on the frame's own 'load' event — this is
// the fix for a real bug: DOMContentLoaded on the *outer* page does not guarantee any given
// <iframe> has finished navigating to its real content yet, so attaching listeners only once, at
// that point, frequently binds them to a placeholder document the browser is about to discard
// the moment the frame's actual content finishes loading. Ctrl+Click inside the frame then
// dispatches a perfectly real click — confirmed live, the event fires and even
// document.querySelector resolves the element correctly — but nothing is listening on the
// document that's actually displayed, so it silently does nothing, forever, for that frame.
// Cross-origin content still can't be inspected (the browser enforces that, not this tool) but
// is now reported via frame-notice from wherever it's first discovered, not just from the top
// document's initial pass.
function setupFrame(frame, depth) {
  if (depth > MAX_FRAME_DEPTH) return;
  const label = frame.getAttribute("src") || frame.getAttribute("name") || "iframe";

  const tryAttach = () => {
    let innerDoc;
    try {
      innerDoc = frame.contentDocument;
    } catch {
      reportCrossOriginFrame(label);
      return;
    }
    if (!innerDoc || !innerDoc.body) return; // not navigated yet — the frame's own 'load' will retry
    attachCaptureListeners(innerDoc, label);
    watchForFrames(innerDoc, depth + 1);
  };

  tryAttach();
  frame.addEventListener("load", tryAttach);
}

// Finds every <iframe> currently inside `doc` and wires each one up, then keeps watching for
// ones added later — a route change in a client-rendered app, a lazy-loaded widget, a frame
// swapped in after some user action — since those never existed at the point this ran the first
// time and would otherwise never get capture support at all.
function watchForFrames(doc, depth) {
  for (const frame of Array.from(doc.querySelectorAll("iframe"))) setupFrame(frame, depth);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.tagName === "IFRAME") setupFrame(node, depth);
        else if (typeof node.querySelectorAll === "function") {
          for (const frame of node.querySelectorAll("iframe")) setupFrame(frame, depth);
        }
      }
    }
  });
  observer.observe(doc.documentElement || doc, { childList: true, subtree: true });
}

function init() {
  attachCaptureListeners(document, null);
  watchForFrames(document, 1);
  ipcRenderer.on("set-capture-mode", (_event, enabled) => {
    captureModeEnabled = enabled;
    if (!enabled) hideHighlight(document);
  });
  ipcRenderer.sendToHost("navigated", { url: document.location.href, title: document.title });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
