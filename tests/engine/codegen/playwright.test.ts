import { describe, expect, it } from "vitest";
import { playwrightJavaGenerator } from "@/engine/codegen/playwrightJava";
import { playwrightJsGenerator } from "@/engine/codegen/playwrightJs";
import { playwrightPythonGenerator } from "@/engine/codegen/playwrightPython";
import { playwrightTsGenerator } from "@/engine/codegen/playwrightTs";
import { loginButtonElement, usernameInputElement } from "./fixtures";

describe("Playwright TypeScript / JavaScript", () => {
  it("prefers getByTestId when a data-testid candidate exists — matches the doc's example", () => {
    // section 23: page.getByTestId('login-button')
    expect(playwrightTsGenerator.generateDeclaration(loginButtonElement())).toBe(
      `const loginSubmitButton = page.getByTestId('login-button');`,
    );
    expect(playwrightJsGenerator.generateDeclaration(loginButtonElement())).toBe(
      `const loginSubmitButton = page.getByTestId('login-button');`,
    );
  });

  it("falls back to getByRole with the associated label as the accessible name", () => {
    expect(playwrightTsGenerator.generateDeclaration(usernameInputElement())).toBe(
      `const usernameInput = page.getByRole('textbox', { name: 'Username' });`,
    );
  });

  it("TS and JS produce identical declarations (no type annotation needed for a Locator)", () => {
    const el = loginButtonElement();
    expect(playwrightTsGenerator.generateDeclaration(el)).toBe(playwrightJsGenerator.generateDeclaration(el));
  });
});

describe("Playwright Python", () => {
  it("uses snake_case methods and variable names", () => {
    expect(playwrightPythonGenerator.generateDeclaration(loginButtonElement())).toBe(
      `login_submit_button = page.get_by_test_id('login-button')`,
    );
    expect(playwrightPythonGenerator.generateDeclaration(usernameInputElement())).toBe(
      `username_input = page.get_by_role('textbox', name='Username')`,
    );
  });
});

describe("Playwright Java", () => {
  it("declares a Locator and uses the AriaRole enum for role-based lookups", () => {
    expect(playwrightJavaGenerator.generateDeclaration(loginButtonElement())).toBe(
      `Locator loginSubmitButton = page.getByTestId("login-button");`,
    );
    expect(playwrightJavaGenerator.generateDeclaration(usernameInputElement())).toBe(
      `Locator usernameInput = page.getByRole(AriaRole.TEXTBOX, new Page.GetByRoleOptions().setName("Username"));`,
    );
  });
});
