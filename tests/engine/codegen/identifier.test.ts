import { describe, expect, it } from "vitest";
import { toCamelCase, toPascalCase, toSnakeCase, toUpperSnakeCase } from "@/engine/codegen/identifier";

describe("identifier casing", () => {
  it("converts a human-readable element name to each target casing", () => {
    expect(toCamelCase("Login Submit Button")).toBe("loginSubmitButton");
    expect(toPascalCase("Login Submit Button")).toBe("LoginSubmitButton");
    expect(toSnakeCase("Login Submit Button")).toBe("login_submit_button");
    expect(toUpperSnakeCase("Login Submit Button")).toBe("LOGIN_SUBMIT_BUTTON");
  });

  it("strips disambiguation suffixes like '(in loginForm)' before casing", () => {
    expect(toCamelCase("Username Input (in loginForm)")).toBe("usernameInput");
  });

  it("falls back to a reserved name when nothing alphanumeric remains", () => {
    expect(toCamelCase("###")).toBe("element");
    expect(toUpperSnakeCase("")).toBe("ELEMENT");
  });

  // Regression: an already-camelCase/PascalCase input (e.g. a user-typed Page Object class name)
  // used to collapse into one word and get re-cased wrong ("LoginPage" -> "Loginpage") since word
  // boundaries were only ever detected from spaces/punctuation, never from a case change.
  it("preserves word boundaries in an already-cased input instead of collapsing them", () => {
    expect(toPascalCase("LoginPage")).toBe("LoginPage");
    expect(toCamelCase("LoginPage")).toBe("loginPage");
    expect(toSnakeCase("LoginPage")).toBe("login_page");
    expect(toPascalCase("userProfileCard")).toBe("UserProfileCard");
  });
});
