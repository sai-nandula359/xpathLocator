import { describe, expect, it } from "vitest";
import { DEVICE_CATEGORIES, DEVICE_PRESETS, findDevicePreset } from "@/devicePresets";

describe("DEVICE_PRESETS", () => {
  it("has a unique, non-empty id for every preset", () => {
    const ids = DEVICE_PRESETS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.length > 0)).toBe(true);
  });

  it("has a positive width, height, and device scale factor for every preset", () => {
    for (const d of DEVICE_PRESETS) {
      expect(d.width, d.id).toBeGreaterThan(0);
      expect(d.height, d.id).toBeGreaterThan(0);
      expect(d.deviceScaleFactor, d.id).toBeGreaterThan(0);
    }
  });

  it("gives every mobile-flagged preset a non-empty user agent (an emulated phone/tablet should look like one)", () => {
    for (const d of DEVICE_PRESETS.filter((d) => d.mobile)) {
      expect(d.userAgent.length, d.id).toBeGreaterThan(0);
    }
  });

  it("falls back to the browser's own default user agent for laptop/desktop presets (empty string)", () => {
    for (const d of DEVICE_PRESETS.filter((d) => !d.mobile)) {
      expect(d.userAgent).toBe("");
    }
  });

  it("every declared category has at least one preset", () => {
    for (const category of DEVICE_CATEGORIES) {
      expect(DEVICE_PRESETS.some((d) => d.category === category), category).toBe(true);
    }
  });
});

describe("findDevicePreset", () => {
  it("finds a known preset by id", () => {
    expect(findDevicePreset("iphone-se")?.width).toBe(375);
  });

  it("returns null for an unknown id", () => {
    expect(findDevicePreset("not-a-real-device")).toBeNull();
  });
});
