import { describe, expect, it } from "vitest";
import { friendlyLocatorLabel } from "@/engine/locatorLabel";
import type { LocatorCandidate } from "@/types";

const ZERO_SCORE = { uniqueness: 0, attributeStability: 0, domDependency: 0, readability: 0, length: 0, dynamicRisk: 0, total: 0 };

function candidate(overrides: Partial<LocatorCandidate>): LocatorCandidate {
  return {
    id: "c1",
    type: "xpath-attribute",
    value: "//div",
    usesDynamicAttribute: false,
    score: { ...ZERO_SCORE },
    classification: "fallback",
    ...overrides,
  };
}

describe("friendlyLocatorLabel", () => {
  it("names a data-testid attribute candidate as Test ID regardless of underlying type", () => {
    expect(friendlyLocatorLabel(candidate({ type: "xpath-attribute", attributeName: "data-testid" }))).toBe("Test ID");
    expect(friendlyLocatorLabel(candidate({ type: "css", attributeName: "data-testid" }))).toBe("Test ID (CSS)");
  });

  it("names id/name/class/placeholder/aria-label/role candidates distinctly", () => {
    expect(friendlyLocatorLabel(candidate({ type: "xpath-id", attributeName: "id" }))).toBe("ID");
    expect(friendlyLocatorLabel(candidate({ type: "xpath-name", attributeName: "name" }))).toBe("Name");
    expect(friendlyLocatorLabel(candidate({ type: "xpath-class", attributeName: "class" }))).toBe("Class");
    expect(friendlyLocatorLabel(candidate({ type: "xpath-attribute", attributeName: "placeholder" }))).toBe("Placeholder");
    expect(friendlyLocatorLabel(candidate({ type: "xpath-attribute", attributeName: "aria-label" }))).toBe("ARIA Label");
    expect(friendlyLocatorLabel(candidate({ type: "xpath-attribute", attributeName: "role" }))).toBe("Role");
  });

  it("names link-text, partial-link-text and position candidates", () => {
    expect(friendlyLocatorLabel(candidate({ type: "xpath-linktext" }))).toBe("Link Text");
    expect(friendlyLocatorLabel(candidate({ type: "xpath-partial-linktext" }))).toBe("Partial Link Text");
    expect(friendlyLocatorLabel(candidate({ type: "xpath-position", value: "//div[position()=2]" }))).toBe("Position");
    expect(friendlyLocatorLabel(candidate({ type: "xpath-position", value: "//div[last()]" }))).toBe("Position (Last)");
  });

  it("names an axis candidate with its specific axis", () => {
    expect(friendlyLocatorLabel(candidate({ type: "xpath-axis", axis: "parent" }))).toBe("Axis (parent)");
  });

  it("falls back to a generic CSS Selector label when a css candidate has no attributeName", () => {
    expect(friendlyLocatorLabel(candidate({ type: "css", attributeName: undefined, value: "div > span" }))).toBe(
      "CSS Selector",
    );
  });

  it("names the SelectorsHub-style positional CSS path distinctly", () => {
    expect(friendlyLocatorLabel(candidate({ type: "css", value: "div:nth-of-type(2) > span:nth-of-type(1)" }))).toBe(
      "Positional CSS",
    );
  });
});
