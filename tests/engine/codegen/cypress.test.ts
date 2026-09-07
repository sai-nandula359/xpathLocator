import { describe, expect, it } from "vitest";
import { cypressGenerator } from "@/engine/codegen/cypress";
import { loginButtonElement, usernameInputElement } from "./fixtures";

describe("Cypress", () => {
  it("prefers a data-testid attribute selector — matches the doc's example shape", () => {
    // section 27: cy.get('[data-testid="login-button"]')
    expect(cypressGenerator.generateDeclaration(loginButtonElement())).toBe(
      `cy.get('[data-testid="login-button"]')`,
    );
  });

  it("falls back to the best CSS candidate when there's no id or test-id", () => {
    expect(cypressGenerator.generateDeclaration(usernameInputElement())).toBe(
      `cy.get('input[name=\\'username\\']')`,
    );
  });

  it("uses a #id selector when the id is CSS-safe", () => {
    const el = loginButtonElement();
    el.candidates = el.candidates.filter((c) => c.id !== "cand-testid");
    expect(cypressGenerator.generateDeclaration(el)).toBe(`cy.get('#loginButton')`);
  });
});
