import { describe, expect, it } from "vitest";
import { seleniumCsharpGenerator } from "@/engine/codegen/seleniumCsharp";
import { seleniumJavaGenerator } from "@/engine/codegen/seleniumJava";
import { seleniumPythonGenerator } from "@/engine/codegen/seleniumPython";
import { loginButtonElement, usernameInputElement } from "./fixtures";

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
