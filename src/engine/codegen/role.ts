// ARIA role + accessible-name inference for Playwright's getByRole(role, { name }) — Playwright
// matches an element's *implicit* role from its tag/type even with no `role` attribute in the
// markup, which the engine's existing attribute-based XPath generator (engine/xpath/attribute.ts)
// doesn't cover (it only fires on a literal `role="..."` attribute). This is genuinely new
// inference, not a re-export of something the engine already computes.

import type { ElementSnapshot } from "@/types";

const INPUT_TYPE_ROLE: Record<string, string> = {
  button: "button",
  submit: "button",
  reset: "button",
  checkbox: "checkbox",
  radio: "radio",
  range: "slider",
  search: "searchbox",
};

const TAG_ROLE: Record<string, string> = {
  button: "button",
  select: "combobox",
  textarea: "textbox",
  h1: "heading",
  h2: "heading",
  h3: "heading",
  h4: "heading",
  h5: "heading",
  h6: "heading",
  ul: "list",
  ol: "list",
  li: "listitem",
  table: "table",
  nav: "navigation",
  main: "main",
  form: "form",
  img: "img",
};

export function inferRole(snapshot: ElementSnapshot): string | null {
  const explicit = snapshot.attributes.role;
  if (explicit) return explicit;

  if (snapshot.tag === "a") return snapshot.attributes.href ? "link" : null;
  if (snapshot.tag === "input") {
    const type = (snapshot.attributes.type || "text").toLowerCase();
    if (type in INPUT_TYPE_ROLE) return INPUT_TYPE_ROLE[type];
    return "textbox"; // text/email/tel/url/search/password/number/no-type all render as textbox
  }
  return TAG_ROLE[snapshot.tag] ?? null;
}

/** Approximates the W3C accessible-name computation with the signals the engine already
 * captures — aria-label, an associated label, visible text, then title. Same priority
 * engine/namer.ts's suggestElementName() uses, kept separate since that function also appends
 * a type suffix ("... Button") that an accessible name must not include. */
export function accessibleName(snapshot: ElementSnapshot): string | null {
  const { attributes, labelAnchor, nearbyLabelText, text, innerText } = snapshot;
  if (attributes["aria-label"]) return attributes["aria-label"].trim();
  if (labelAnchor?.element.text) return labelAnchor.element.text.trim();
  if (nearbyLabelText) return nearbyLabelText.trim();
  const visible = (text || innerText).trim();
  if (visible) return visible;
  if (attributes.title) return attributes.title.trim();
  return null;
}
