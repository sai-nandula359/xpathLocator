// section 22 — CSS Selector generation. Kept as a single module (rather than split like the
// XPath generators) since CSS has far fewer distinct forms than XPath does.

import { isDynamicAttributeName, isDynamicValue } from "@/engine/dynamicAttributeDetector";
import type { RawCandidate } from "@/engine/types";
import type { ElementSnapshot, StabilitySettings } from "@/types";

const CSS_IDENT_RE = /^-?[_a-zA-Z][_a-zA-Z0-9-]*$/;

function cssStringEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function attrSelector(tag: string, attr: string, value: string): string {
  return `${tag}[${attr}="${cssStringEscape(value)}"]`;
}

const HANDLED_ELSEWHERE = new Set(["id", "class"]);
const NOTABLE_ATTRIBUTES = ["name", "aria-label", "role", "placeholder", "title", "type", "href", "alt"];

export function generateCss(snapshot: ElementSnapshot, settings: StabilitySettings): RawCandidate[] {
  const { tag, attributes, classList, isSensitive } = snapshot;
  const candidates: RawCandidate[] = [];

  const id = attributes.id;
  if (id) {
    candidates.push({
      type: "css",
      value: CSS_IDENT_RE.test(id) ? `${tag}#${id}` : attrSelector(tag, "id", id),
      usesDynamicAttribute: isDynamicValue(id),
      attributeName: "id",
    });
  }

  if (classList.length > 0) {
    const stableToken = classList.find((token) => !isDynamicValue(token)) ?? classList[0];
    candidates.push({
      type: "css",
      value: CSS_IDENT_RE.test(stableToken)
        ? `${tag}.${stableToken}`
        : `${tag}[class~="${cssStringEscape(stableToken)}"]`,
      usesDynamicAttribute: isDynamicValue(stableToken),
      attributeName: "class",
    });
  }

  const seen = new Set(["id", "class"]);
  const considerAttr = (attrName: string) => {
    if (HANDLED_ELSEWHERE.has(attrName) || seen.has(attrName)) return;
    if (attrName === "value" && isSensitive) return;
    const value = attributes[attrName];
    if (!value) return;
    seen.add(attrName);
    candidates.push({
      type: "css",
      value: attrSelector(tag, attrName, value),
      usesDynamicAttribute: isDynamicAttributeName(attrName) || isDynamicValue(value),
      attributeName: attrName,
    });
  };

  for (const attrName of settings.testIdAttributes) considerAttr(attrName);
  for (const attrName of NOTABLE_ATTRIBUTES) considerAttr(attrName);
  for (const attrName of Object.keys(attributes)) {
    if (attrName.startsWith("data-")) considerAttr(attrName);
  }

  if (attributes.type && attributes.name) {
    candidates.push({
      type: "css",
      value: `${tag}[type="${cssStringEscape(attributes.type)}"][name="${cssStringEscape(attributes.name)}"]`,
      usesDynamicAttribute: isDynamicValue(attributes.type) || isDynamicValue(attributes.name),
    });
  }

  return candidates;
}

/** section 22 / SelectorsHub-style "Rel cssSelector" — a full positional CSS path built purely
 * from the ancestor chain (already collected for xpath-absolute), for parity with that XPath
 * candidate: a guaranteed-valid CSS fallback for CSS-preferring frameworks (Cypress, Playwright's
 * page.locator()) when nothing else disambiguates. Uses :nth-of-type(N), not :nth-child(N) —
 * ancestorChain's `index` is already "position among same-tag siblings" (computed once in
 * webview-preload.cjs's ancestorChainFor(), shared with the XPath candidate), which is exactly
 * what :nth-of-type counts; :nth-child counts *all* siblings regardless of tag and would need
 * different data. Mirrors engine/xpath/absolute.ts's html-index-omission convention. */
export function generatePositionalCss(snapshot: ElementSnapshot): RawCandidate[] {
  if (snapshot.ancestorChain.length === 0) return [];

  const segments = snapshot.ancestorChain.map((seg) =>
    seg.tag === "html" ? "html" : `${seg.tag}:nth-of-type(${seg.index})`,
  );

  return [
    {
      type: "css",
      value: segments.join(" > "),
      usesDynamicAttribute: false,
    },
  ];
}
