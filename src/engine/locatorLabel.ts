// section 21 — "Locator Types". Most of the named strategies the spec lists (ID, Name, Class,
// Placeholder, ARIA Label, Role, Test ID) are already generated today as xpath-attribute/css
// candidates carrying an `attributeName` — they just aren't labeled distinctly anywhere in the
// UI, so a user can't tell "this is the Test ID locator" from "this is just some attribute
// predicate" at a glance. This maps a candidate to the spec's named type for display, without
// forking the generation pipeline into a new LocatorType per attribute.

import { DEFAULT_STABILITY_SETTINGS, isTestIdAttribute } from "@/engine/stabilityConfig";
import { isPositionalCss } from "@/engine/scorer";
import type { LocatorCandidate, StabilitySettings } from "@/types";

const ATTRIBUTE_LABELS: Record<string, string> = {
  id: "ID",
  name: "Name",
  class: "Class",
  placeholder: "Placeholder",
  "aria-label": "ARIA Label",
  "aria-labelledby": "ARIA Label",
  role: "Role",
  title: "Title",
  href: "Href",
  alt: "Alt Text",
  type: "Type",
};

function attributeLabel(attributeName: string, settings: StabilitySettings): string {
  if (isTestIdAttribute(attributeName, settings)) return "Test ID";
  return ATTRIBUTE_LABELS[attributeName] ?? `Attribute: ${attributeName}`;
}

export function friendlyLocatorLabel(
  candidate: LocatorCandidate,
  settings: StabilitySettings = DEFAULT_STABILITY_SETTINGS,
): string {
  switch (candidate.type) {
    case "xpath-absolute":
      return "Absolute XPath";
    case "xpath-indexed":
      return "Indexed";
    case "xpath-position":
      return candidate.value.includes("last()") ? "Position (Last)" : "Position";
    case "xpath-axis":
      return candidate.axis ? `Axis (${candidate.axis})` : "Axis";
    case "xpath-text":
      return "Text";
    case "xpath-linktext":
      return "Link Text";
    case "xpath-partial-linktext":
      return "Partial Link Text";
    case "xpath-combination":
      return "Combination";
    case "css":
      if (isPositionalCss(candidate)) return "Positional CSS";
      return candidate.attributeName ? `${attributeLabel(candidate.attributeName, settings)} (CSS)` : "CSS Selector";
    case "xpath-id":
    case "xpath-name":
    case "xpath-class":
    case "xpath-attribute":
      return candidate.attributeName ? attributeLabel(candidate.attributeName, settings) : "Attribute";
    default:
      return candidate.type;
  }
}
