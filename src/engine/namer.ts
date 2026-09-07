// sections 29-30 — Element Naming and Name Conflict Handling. "Accessible name" in the doc's
// priority list technically means the full W3C accessible-name-computation algorithm; that
// algorithm is substantial enough to be its own feature, so this approximates it with the
// signals we do capture (aria-label, an associated <label>, visible text) in the same relative
// order, which covers the overwhelming majority of real form controls.

import type { ElementAttributes, ElementSnapshot } from "@/types";

const TYPE_SUFFIX: Record<string, string> = {
  submit: "Submit Button",
  button: "Button",
  reset: "Reset Button",
  checkbox: "Checkbox",
  radio: "Radio Button",
  email: "Input",
  password: "Password Input",
  search: "Search Input",
  text: "Input",
  number: "Input",
  tel: "Input",
  url: "Input",
  file: "File Input",
};

const TAG_SUFFIX: Record<string, string> = {
  button: "Button",
  a: "Link",
  select: "Dropdown",
  textarea: "Text Area",
  input: "Input",
  img: "Image",
  table: "Table",
  form: "Form",
};

function suffixFor(snapshot: ElementSnapshot): string {
  const type = snapshot.attributes.type?.toLowerCase();
  if ((snapshot.tag === "input" || snapshot.tag === "button") && type && TYPE_SUFFIX[type]) {
    return TYPE_SUFFIX[type];
  }
  if (TAG_SUFFIX[snapshot.tag]) return TAG_SUFFIX[snapshot.tag];
  return snapshot.tag.charAt(0).toUpperCase() + snapshot.tag.slice(1);
}

/** kebab-case / snake_case / camelCase -> "Title Case", stripping common generic prefixes. */
function humanize(raw: string): string {
  const stripped = raw.replace(/^(js-|id-|el-)/i, "");
  const spaced = stripped
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .trim();
  if (!spaced) return "";
  return spaced
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const MAX_LABEL_LENGTH = 40;

function truncate(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > MAX_LABEL_LENGTH ? `${trimmed.slice(0, MAX_LABEL_LENGTH).trim()}…` : trimmed;
}

function baseLabel(snapshot: ElementSnapshot): string | null {
  const { attributes, nearbyLabelText, innerText, text } = snapshot;
  if (attributes["aria-label"]) return truncate(attributes["aria-label"]);
  if (nearbyLabelText) return truncate(nearbyLabelText);
  const visible = (text || innerText).trim();
  if (visible) return truncate(visible);
  if (attributes.title) return truncate(attributes.title);
  if (attributes.placeholder) return truncate(attributes.placeholder);
  if (attributes.id) {
    const h = humanize(attributes.id);
    if (h) return h;
  }
  if (attributes.name) {
    const h = humanize(attributes.name);
    if (h) return h;
  }
  return null;
}

export function suggestElementName(snapshot: ElementSnapshot): string {
  const suffix = suffixFor(snapshot);
  const label = baseLabel(snapshot);
  if (!label) return suffix;
  if (label.toLowerCase().endsWith(suffix.toLowerCase())) return label;
  return `${label} ${suffix}`;
}

function contextHint(attributes: ElementAttributes | null, tag: string | null): string | null {
  if (attributes) {
    if (attributes["data-testid"]) return attributes["data-testid"];
    if (attributes.id) return attributes.id;
    if (attributes["aria-label"]) return attributes["aria-label"];
  }
  return tag;
}

/**
 * Resolves a name collision using DOM context (the containing element) rather than a bare
 * `Element_1` counter, per section 30. Falls back to a numeric suffix only if even that still
 * collides — e.g. two genuinely identical rows in a list.
 */
export function disambiguateName(
  candidateName: string,
  existingNames: ReadonlySet<string>,
  snapshot: ElementSnapshot,
): string {
  if (!existingNames.has(candidateName)) return candidateName;

  const hint = contextHint(snapshot.parentAttributes, snapshot.parentTag);
  if (hint) {
    const withContext = `${candidateName} (in ${hint})`;
    if (!existingNames.has(withContext)) return withContext;
  }

  let counter = 2;
  let attempt = `${candidateName} ${counter}`;
  while (existingNames.has(attempt)) {
    counter += 1;
    attempt = `${candidateName} ${counter}`;
  }
  return attempt;
}
