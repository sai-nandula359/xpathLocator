import { describe, expect, it } from "vitest";
import { generateLinkText } from "@/engine/xpath/linkText";
import { makeSnapshot } from "./fixtures";

describe("generateLinkText", () => {
  it("produces exact and partial link-text candidates for an <a> with visible text", () => {
    const snapshot = makeSnapshot({ tag: "a", text: "Learn More", innerText: "Learn More" });
    const candidates = generateLinkText(snapshot);
    expect(candidates).toContainEqual(
      expect.objectContaining({ type: "xpath-linktext", value: "//a[text()='Learn More']" }),
    );
    expect(candidates).toContainEqual(
      expect.objectContaining({ type: "xpath-partial-linktext", value: "//a[contains(text(), 'Learn More')]" }),
    );
  });

  it("produces nothing for a non-<a> element, even with matching text", () => {
    const snapshot = makeSnapshot({ tag: "button", text: "Learn More", innerText: "Learn More" });
    expect(generateLinkText(snapshot)).toEqual([]);
  });

  it("produces nothing for an <a> with no visible text", () => {
    const snapshot = makeSnapshot({ tag: "a", text: "", innerText: "" });
    expect(generateLinkText(snapshot)).toEqual([]);
  });

  it("skips the exact-text candidate when the text is too long, but still offers a partial match", () => {
    const longText = "x".repeat(80);
    const snapshot = makeSnapshot({ tag: "a", text: longText, innerText: longText });
    const candidates = generateLinkText(snapshot);
    expect(candidates.some((c) => c.type === "xpath-linktext")).toBe(false);
    expect(candidates.some((c) => c.type === "xpath-partial-linktext")).toBe(true);
  });

  it("flags dynamic-looking link text as a dynamic-attribute risk", () => {
    const snapshot = makeSnapshot({ tag: "a", text: "550e8400-e29b-41d4-a716-446655440000", innerText: "550e8400-e29b-41d4-a716-446655440000" });
    const candidates = generateLinkText(snapshot);
    expect(candidates.every((c) => c.usesDynamicAttribute)).toBe(true);
  });
});
