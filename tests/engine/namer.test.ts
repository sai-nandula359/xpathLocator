import { describe, expect, it } from "vitest";
import { disambiguateName, suggestElementName } from "@/engine/namer";
import { loginButtonSnapshot, makeSnapshot, usernameInputSnapshot } from "./fixtures";

describe("suggestElementName", () => {
  it("matches the doc's own examples: 'Submit Button' and 'Username Input'", () => {
    expect(suggestElementName(loginButtonSnapshot())).toBe("Login Submit Button");
    expect(suggestElementName(usernameInputSnapshot())).toBe("Username Input");
  });

  it("prefers aria-label over visible text", () => {
    const snapshot = makeSnapshot({
      tag: "button",
      text: "X",
      attributes: { "aria-label": "Close dialog" },
    });
    expect(suggestElementName(snapshot)).toBe("Close dialog Button");
  });

  it("falls back to a humanized id when there is no text or label", () => {
    const snapshot = makeSnapshot({
      tag: "input",
      attributes: { id: "shipping-zip-code", type: "text" },
    });
    expect(suggestElementName(snapshot)).toBe("Shipping Zip Code Input");
  });

  it("falls back to a generic tag-based name when nothing else is available", () => {
    const snapshot = makeSnapshot({ tag: "select" });
    expect(suggestElementName(snapshot)).toBe("Dropdown");
  });
});

describe("disambiguateName", () => {
  it("returns the name unchanged when there's no collision", () => {
    expect(disambiguateName("Submit Button", new Set(), makeSnapshot())).toBe("Submit Button");
  });

  it("disambiguates using DOM context (a parent id) rather than a bare counter", () => {
    const snapshot = makeSnapshot({ parentTag: "form", parentAttributes: { id: "loginForm" } });
    const result = disambiguateName("Submit Button", new Set(["Submit Button"]), snapshot);
    expect(result).toBe("Submit Button (in loginForm)");
  });

  it("falls back to a numeric suffix only when the context-qualified name also collides", () => {
    const snapshot = makeSnapshot({ parentTag: "form", parentAttributes: { id: "loginForm" } });
    const existing = new Set(["Submit Button", "Submit Button (in loginForm)"]);
    expect(disambiguateName("Submit Button", existing, snapshot)).toBe("Submit Button 2");
  });
});
