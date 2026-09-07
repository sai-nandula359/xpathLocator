import type { StabilitySettings } from "@/types";

// Default stable-attribute priority — section 17's list, most stable first. This is the *only*
// source of truth scorer.ts's attributeTier() uses to weight a candidate's "Attribute
// Stability" score (section 19) for every attribute-keyed candidate, so reordering it via
// Settings actually changes ranking behavior — not just what's displayed. "text" isn't included
// here since it isn't an HTML attribute; text-based candidates get their own fixed tier.
export const DEFAULT_ATTRIBUTE_PRIORITY = [
  "data-testid",
  "data-test",
  "data-test-id",
  "data-qa",
  "data-cy",
  "data-automation-id",
  "data-automation",
  "data-e2e",
  "aria-label",
  "aria-labelledby",
  "id",
  "name",
  "role",
  "placeholder",
  "href",
  "alt",
  "title",
  "type",
  "class",
  "tabindex",
] as const;

// section 52 — recognized test-id style attributes.
export const DEFAULT_TEST_ID_ATTRIBUTES = [
  "data-testid",
  "data-test",
  "data-test-id",
  "data-qa",
  "data-cy",
  "data-automation-id",
  "data-automation",
  "data-e2e",
];

export const DEFAULT_STABILITY_SETTINGS: StabilitySettings = {
  attributePriority: [...DEFAULT_ATTRIBUTE_PRIORITY],
  testIdAttributes: [...DEFAULT_TEST_ID_ATTRIBUTES],
};

/** Index of `attrName` in the configured priority list; -1 if not present (least stable). */
export function attributeStabilityRank(
  attrName: string,
  settings: StabilitySettings = DEFAULT_STABILITY_SETTINGS,
): number {
  return settings.attributePriority.indexOf(attrName);
}

export function isTestIdAttribute(
  attrName: string,
  settings: StabilitySettings = DEFAULT_STABILITY_SETTINGS,
): boolean {
  return settings.testIdAttributes.includes(attrName);
}
