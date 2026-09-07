import { describe, expect, it } from "vitest";
import { DEFAULT_STABILITY_SETTINGS } from "@/engine/stabilityConfig";
import { generateAttribute } from "@/engine/xpath/attribute";
import { loginButtonSnapshot, makeSnapshot } from "./fixtures";

describe("generateAttribute", () => {
  it("generates a data-testid candidate ahead of other attributes", () => {
    const candidates = generateAttribute(loginButtonSnapshot(), DEFAULT_STABILITY_SETTINGS);
    const testId = candidates.find((c) => c.attributeName === "data-testid");
    expect(testId?.value).toBe("//button[@data-testid='login-button']");
    expect(testId?.type).toBe("xpath-attribute");
  });

  it("never generates a candidate keyed on id/name/class (handled by relative.ts)", () => {
    const candidates = generateAttribute(loginButtonSnapshot(), DEFAULT_STABILITY_SETTINGS);
    expect(candidates.some((c) => c.attributeName === "id")).toBe(false);
    expect(candidates.some((c) => c.attributeName === "class")).toBe(false);
  });

  it("builds a type+class combination candidate when no name attribute exists", () => {
    const candidates = generateAttribute(loginButtonSnapshot(), DEFAULT_STABILITY_SETTINGS);
    const combo = candidates.find((c) => c.type === "xpath-combination");
    expect(combo?.value).toBe("//button[@type='submit' and contains(@class, 'btn')]");
  });

  it("builds a type+name combination candidate when a name attribute exists", () => {
    const snapshot = makeSnapshot({
      tag: "input",
      attributes: { type: "radio", name: "plan" },
    });
    const candidates = generateAttribute(snapshot, DEFAULT_STABILITY_SETTINGS);
    const combo = candidates.find((c) => c.type === "xpath-combination");
    expect(combo?.value).toBe("//input[@type='radio' and @name='plan']");
  });

  it("never reads the value of a sensitive field", () => {
    const snapshot = makeSnapshot({
      tag: "input",
      attributes: { type: "password", value: "hunter2", placeholder: "Password" },
      isSensitive: true,
    });
    const candidates = generateAttribute(snapshot, DEFAULT_STABILITY_SETTINGS);
    expect(candidates.some((c) => c.value.includes("hunter2"))).toBe(false);
    // Non-sensitive attributes on the same field are still fair game.
    expect(candidates.some((c) => c.attributeName === "placeholder")).toBe(true);
  });

  it("picks up custom data-* attributes not on the curated list", () => {
    const snapshot = makeSnapshot({ tag: "div", attributes: { "data-widget-id": "sidebar" } });
    const candidates = generateAttribute(snapshot, DEFAULT_STABILITY_SETTINGS);
    expect(candidates.some((c) => c.attributeName === "data-widget-id")).toBe(true);
  });
});
