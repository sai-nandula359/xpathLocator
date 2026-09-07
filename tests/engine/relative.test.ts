import { describe, expect, it } from "vitest";
import { generateRelative } from "@/engine/xpath/relative";
import { loginButtonSnapshot, makeSnapshot, usernameInputSnapshot } from "./fixtures";

describe("generateRelative", () => {
  it("generates id, name and class candidates when present", () => {
    const candidates = generateRelative(loginButtonSnapshot());
    const byType = Object.fromEntries(candidates.map((c) => [c.type, c.value]));
    expect(byType["xpath-id"]).toBe("//button[@id='loginButton']");
    expect(byType["xpath-class"]).toBe("//button[contains(@class, 'btn')]");
    expect(byType["xpath-name"]).toBeUndefined();
  });

  it("generates a name candidate for the username field", () => {
    const candidates = generateRelative(usernameInputSnapshot());
    const name = candidates.find((c) => c.type === "xpath-name");
    expect(name?.value).toBe("//input[@name='username']");
  });

  it("prefers a non-dynamic-looking class token over the first one", () => {
    const snapshot = makeSnapshot({
      tag: "div",
      attributes: { class: "css-a1b2c3d4e5 stable-widget" },
      classList: ["css-a1b2c3d4e5", "stable-widget"],
    });
    const [candidate] = generateRelative(snapshot);
    expect(candidate.value).toContain("stable-widget");
    expect(candidate.usesDynamicAttribute).toBe(false);
  });

  it("escapes an embedded single quote using double quotes", () => {
    const snapshot = makeSnapshot({ tag: "div", attributes: { id: "it's-fine" } });
    const [candidate] = generateRelative(snapshot);
    expect(candidate.value).toBe(`//div[@id="it's-fine"]`);
  });

  it("returns nothing when there is no id, name or class", () => {
    expect(generateRelative(makeSnapshot())).toEqual([]);
  });
});
