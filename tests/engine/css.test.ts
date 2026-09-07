import { describe, expect, it } from "vitest";
import { generateCss, generatePositionalCss } from "@/engine/css";
import { DEFAULT_STABILITY_SETTINGS } from "@/engine/stabilityConfig";
import { loginButtonSnapshot, makeSnapshot } from "./fixtures";

describe("generateCss", () => {
  it("matches the doc's own id/data-testid CSS examples", () => {
    const candidates = generateCss(loginButtonSnapshot(), DEFAULT_STABILITY_SETTINGS);
    const values = candidates.map((c) => c.value);
    expect(values).toContain("button#loginButton");
    expect(values).toContain('button[data-testid="login-button"]');
  });

  it("falls back to an attribute selector when the id isn't a valid CSS identifier", () => {
    const snapshot = makeSnapshot({ tag: "div", attributes: { id: "1.weird:id" } });
    const [candidate] = generateCss(snapshot, DEFAULT_STABILITY_SETTINGS);
    expect(candidate.value).toBe('div[id="1.weird:id"]');
  });

  it("escapes an embedded double quote in an attribute value", () => {
    const snapshot = makeSnapshot({ tag: "input", attributes: { placeholder: 'Say "hi"' } });
    const candidates = generateCss(snapshot, DEFAULT_STABILITY_SETTINGS);
    const placeholder = candidates.find((c) => c.attributeName === "placeholder");
    expect(placeholder?.value).toBe('input[placeholder="Say \\"hi\\""]');
  });

  it("skips the value attribute on a sensitive field", () => {
    const snapshot = makeSnapshot({
      tag: "input",
      attributes: { type: "password", value: "hunter2" },
      isSensitive: true,
    });
    const candidates = generateCss(snapshot, DEFAULT_STABILITY_SETTINGS);
    expect(candidates.some((c) => c.value.includes("hunter2"))).toBe(false);
  });
});

describe("generatePositionalCss", () => {
  it("builds a full :nth-of-type path from the ancestor chain, omitting the index on html", () => {
    const [candidate] = generatePositionalCss(loginButtonSnapshot());
    expect(candidate.type).toBe("css");
    expect(candidate.value).toBe(
      "html > body:nth-of-type(1) > div:nth-of-type(2) > form:nth-of-type(1) > div:nth-of-type(1) > button:nth-of-type(1)",
    );
  });

  it("returns nothing when there is no ancestor chain", () => {
    expect(generatePositionalCss(makeSnapshot({ ancestorChain: [] }))).toEqual([]);
  });

  it("is never flagged as using a dynamic attribute", () => {
    const [candidate] = generatePositionalCss(loginButtonSnapshot());
    expect(candidate.usesDynamicAttribute).toBe(false);
  });
});
