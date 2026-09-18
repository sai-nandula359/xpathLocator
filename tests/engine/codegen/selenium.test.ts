import { describe, expect, it } from "vitest";
import { seleniumCsharpGenerator } from "@/engine/codegen/seleniumCsharp";
import { seleniumJavaGenerator } from "@/engine/codegen/seleniumJava";
import { seleniumPythonGenerator } from "@/engine/codegen/seleniumPython";
import { makeCandidate, loginButtonElement, navLinkElement, usernameInputElement } from "./fixtures";

describe("Selenium Java", () => {
  it("matches the doc's own worked example for an id'd element", () => {
    // section 24: By loginButton = By.id("loginButton");
    expect(seleniumJavaGenerator.generateDeclaration(loginButtonElement())).toBe(
      `By loginSubmitButton = By.id("loginButton");`,
    );
  });

  it("falls back to By.name when no id is present", () => {
    expect(seleniumJavaGenerator.generateDeclaration(usernameInputElement())).toBe(
      `By usernameInput = By.name("username");`,
    );
  });

  it("joins a block with one declaration per line", () => {
    const block = seleniumJavaGenerator.generateBlock([loginButtonElement(), usernameInputElement()]);
    expect(block.split("\n")).toHaveLength(2);
  });

  it("uses By.linkText, sourced from the snapshot's own text, when a validated xpath-linktext candidate exists", () => {
    expect(seleniumJavaGenerator.generateDeclaration(navLinkElement())).toBe(
      `By learnMoreLink = By.linkText("Learn More");`,
    );
  });

  it("falls back to By.partialLinkText when only a partial-linktext candidate validated", () => {
    const element = navLinkElement([
      makeCandidate({ id: "cand-partial", type: "xpath-partial-linktext", value: "//a[contains(text(), 'Learn')]" }),
    ]);
    expect(seleniumJavaGenerator.generateDeclaration(element)).toBe(
      `By learnMoreLink = By.partialLinkText("Learn More");`,
    );
  });

  it("does NOT use link text for an <a> with no validated link-text candidate, even though the tag is <a>", () => {
    const element = navLinkElement([makeCandidate({ id: "cand-href", type: "xpath-attribute", value: "//a[@href='/learn-more']", attributeName: "href" })]);
    expect(seleniumJavaGenerator.generateDeclaration(element)).not.toContain("linkText");
  });
});

describe("Selenium Python", () => {
  it("matches the doc's own worked example", () => {
    // section 25: login_button = (By.ID, "loginButton")
    expect(seleniumPythonGenerator.generateDeclaration(loginButtonElement())).toBe(
      `login_submit_button = (By.ID, "loginButton")`,
    );
  });

  it("falls back to By.NAME when no id is present", () => {
    expect(seleniumPythonGenerator.generateDeclaration(usernameInputElement())).toBe(
      `username_input = (By.NAME, "username")`,
    );
  });
});

describe("Selenium C#", () => {
  it("uses .NET's PascalCase By.* methods", () => {
    expect(seleniumCsharpGenerator.generateDeclaration(loginButtonElement())).toBe(
      `By LoginSubmitButton = By.Id("loginButton");`,
    );
    expect(seleniumCsharpGenerator.generateDeclaration(usernameInputElement())).toBe(
      `By UsernameInput = By.Name("username");`,
    );
  });
});
