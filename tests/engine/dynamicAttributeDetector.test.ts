import { describe, expect, it } from "vitest";
import {
  extractStablePrefix,
  isDynamicAttribute,
  isDynamicAttributeName,
  isDynamicClassToken,
  isDynamicValue,
} from "@/engine/dynamicAttributeDetector";

describe("isDynamicValue", () => {
  it("flags a UUID", () => {
    expect(isDynamicValue("f47ac10b-58cc-4372-a567-0e02b2c3d479")).toBe(true);
  });

  it("flags a 13-digit millisecond timestamp", () => {
    expect(isDynamicValue("1735689600000")).toBe(true);
  });

  it("flags a numeric-suffixed generated id", () => {
    expect(isDynamicValue("react-select-4821")).toBe(true);
    expect(isDynamicValue("input_88213")).toBe(true);
  });

  it("flags a long hex hash", () => {
    expect(isDynamicValue("a1b2c3d4e5f60718")).toBe(true);
  });

  it("flags common framework-generated tokens", () => {
    expect(isDynamicValue(":r4:")).toBe(true);
    expect(isDynamicValue("mui-42")).toBe(true);
  });

  it("flags a framework-generated token embedded inside a longer, human-prefixed id", () => {
    // Confirmed live on a real production site: React's useId() colon-wrapped token embedded in
    // an otherwise semantic-looking id, e.g. "tabs-:rm:-mobile-booking-widget-modal-tabpanel-0" —
    // the bare-token check alone (framework-generated, above) doesn't catch this shape.
    expect(isDynamicValue("tabs-:rm:-mobile-booking-widget-modal-tabpanel-0")).toBe(true);
    expect(isDynamicValue("panel-radix-3-content")).toBe(true);
  });

  it("does not flag stable, human-chosen identifiers", () => {
    expect(isDynamicValue("loginButton")).toBe(false);
    expect(isDynamicValue("username")).toBe(false);
    expect(isDynamicValue("btn-primary")).toBe(false);
    expect(isDynamicValue("submit")).toBe(false);
  });
});

describe("isDynamicAttributeName", () => {
  it("flags Vue's scoping attribute and Angular's content/host markers", () => {
    expect(isDynamicAttributeName("data-v-7ba5bd90")).toBe(true);
    expect(isDynamicAttributeName("_ngcontent-c14")).toBe(true);
  });

  it("does not flag ordinary attribute names", () => {
    expect(isDynamicAttributeName("data-testid")).toBe(false);
    expect(isDynamicAttributeName("aria-label")).toBe(false);
  });
});

describe("isDynamicClassToken / isDynamicAttribute", () => {
  it("flags a styled-components/CSS-module style class token", () => {
    expect(isDynamicClassToken("css-a1b2c3")).toBe(true);
    expect(isDynamicClassToken("button_a1b2c")).toBe(true);
    expect(isDynamicClassToken("btn-primary")).toBe(false);
  });

  it("isDynamicAttribute treats class as a multi-token attribute", () => {
    expect(isDynamicAttribute("class", "btn btn-primary")).toBe(false);
    expect(isDynamicAttribute("class", "btn css-a1b2c3d4")).toBe(true);
  });
});

describe("extractStablePrefix", () => {
  it("extracts the literal prefix in front of an embedded framework token", () => {
    // The same real-world example isDynamicValue's own tests use above.
    expect(extractStablePrefix("tabs-:rm:-mobile-booking-widget-modal-tabpanel-0")).toBe("tabs");
    expect(extractStablePrefix("panel-radix-3-content")).toBe("panel");
  });

  it("extracts the literal prefix in front of a numeric suffix", () => {
    expect(extractStablePrefix("input-4821")).toBe("input");
    expect(extractStablePrefix("search-widget-99213")).toBe("search-widget");
  });

  it("returns null when the prefix left over is too short to be meaningful", () => {
    expect(extractStablePrefix("id_88213")).toBeNull(); // "id" is only 2 chars
  });

  it("returns null for a value that's dynamic end-to-end, with no stable literal chunk", () => {
    expect(extractStablePrefix("f47ac10b-58cc-4372-a567-0e02b2c3d479")).toBeNull(); // UUID
    expect(extractStablePrefix("1735689600000")).toBeNull(); // timestamp
    expect(extractStablePrefix("a1b2c3d4e5f60718")).toBeNull(); // hash-like
    expect(extractStablePrefix(":r4:")).toBeNull(); // bare framework token
  });

  it("returns null for a value that isn't dynamic in the first place — nothing to salvage", () => {
    expect(extractStablePrefix("loginButton")).toBeNull();
  });
});
