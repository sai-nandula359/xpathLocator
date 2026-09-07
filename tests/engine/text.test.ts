import { describe, expect, it } from "vitest";
import { generateText } from "@/engine/xpath/text";
import { loginButtonSnapshot, makeSnapshot } from "./fixtures";

describe("generateText", () => {
  it("matches the doc's own text()/normalize-space() examples for a Login button", () => {
    const candidates = generateText(loginButtonSnapshot());
    expect(candidates.map((c) => c.value)).toEqual([
      "//button[text()='Login']",
      "//button[normalize-space()='Login']",
    ]);
  });

  it("uses text() from the element's own text, and normalize-space() from full innerText", () => {
    // Own text node is empty (icon-only button with a screen-reader span inside), but the
    // rendered string-value still includes the descendant span's text.
    const snapshot = makeSnapshot({
      tag: "button",
      text: "",
      innerText: "Close dialog",
    });
    const candidates = generateText(snapshot);
    expect(candidates.some((c) => c.value.includes("text()"))).toBe(false);
    expect(candidates.find((c) => c.value.includes("normalize-space()"))?.value).toBe(
      "//button[normalize-space()='Close dialog']",
    );
  });

  it("falls back to contains(normalize-space(), prefix) for long text", () => {
    const longText = "A".repeat(120);
    const snapshot = makeSnapshot({ tag: "p", text: longText, innerText: longText });
    const candidates = generateText(snapshot);
    const containsCandidate = candidates.find((c) => c.value.includes("contains("));
    expect(containsCandidate).toBeDefined();
    expect(containsCandidate!.value.length).toBeLessThan(100);
  });

  it("returns nothing for an element with no text at all", () => {
    expect(generateText(makeSnapshot({ text: "", innerText: "" }))).toEqual([]);
  });
});
