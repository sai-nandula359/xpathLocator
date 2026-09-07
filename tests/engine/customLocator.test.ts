import { describe, expect, it } from "vitest";
import { buildCustomXPath } from "@/engine/customLocator";

describe("buildCustomXPath", () => {
  it("builds a single-attribute predicate", () => {
    expect(buildCustomXPath("input", { id: "location", role: "combobox" }, ["id"])).toBe(
      "//input[@id='location']",
    );
  });

  it("combines several checked attributes with 'and', preserving the given order", () => {
    const attrs = { id: "location", role: "combobox", "aria-controls": "location-listbox" };
    expect(buildCustomXPath("input", attrs, ["role", "aria-controls"])).toBe(
      "//input[@role='combobox' and @aria-controls='location-listbox']",
    );
  });

  it("returns null for an empty selection", () => {
    expect(buildCustomXPath("input", { id: "x" }, [])).toBeNull();
  });

  it("skips a checked name that no longer has a value, rather than emitting @attr=undefined", () => {
    expect(buildCustomXPath("input", { id: "location" }, ["missing"])).toBeNull();
    expect(buildCustomXPath("input", { id: "location" }, ["id", "missing"])).toBe("//input[@id='location']");
  });

  it("switches to double quotes for an attribute value containing a single quote", () => {
    expect(buildCustomXPath("div", { title: "It's here" }, ["title"])).toBe(`//div[@title="It's here"]`);
  });
});
