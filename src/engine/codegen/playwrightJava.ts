// Playwright Java — not given a literal example in the doc, but follows Playwright's real Java
// API: locators return a `Locator`, and getByRole takes an AriaRole enum constant plus an
// options object rather than a plain string (unlike the JS/Python/TS bindings) —
// page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Login")).

import { escapeDoubleQuoted } from "@/engine/codegen/escape";
import { toCamelCase } from "@/engine/codegen/identifier";
import { pickPlaywrightStrategy } from "@/engine/codegen/playwrightStrategy";
import type { CodeGenerator } from "@/engine/codegen/types";
import type { CapturedElement } from "@/types";

// AriaRole enum constants are the role name, upper-snake-cased — every role role.ts infers
// (button, textbox, combobox, searchbox, slider, checkbox, radio, link, heading, list, listitem,
// table, navigation, main, form, img, ...) is a single word or already hyphen-free, so this
// generic conversion covers them without a lookup table.
function ariaRoleConstant(role: string): string {
  return role.replace(/-/g, "_").toUpperCase();
}

function quoteJava(value: string): string {
  return `"${escapeDoubleQuoted(value)}"`;
}

function expression(element: CapturedElement): string {
  const strategy = pickPlaywrightStrategy(element);
  switch (strategy.kind) {
    case "testid":
      return `page.getByTestId(${quoteJava(strategy.testId!)})`;
    case "role":
      return `page.getByRole(AriaRole.${ariaRoleConstant(strategy.role!)}, new Page.GetByRoleOptions().setName(${quoteJava(strategy.name!)}))`;
    case "label":
      return `page.getByLabel(${quoteJava(strategy.name!)})`;
    case "placeholder":
      return `page.getByPlaceholder(${quoteJava(strategy.placeholder!)})`;
    case "text":
      return `page.getByText(${quoteJava(strategy.text!)})`;
    case "locator":
    default:
      return `page.locator(${quoteJava(strategy.locatorValue!)})`;
  }
}

function declaration(element: CapturedElement): string {
  return `Locator ${toCamelCase(element.name)} = ${expression(element)};`;
}

export const playwrightJavaGenerator: CodeGenerator = {
  id: "playwright-java",
  label: "Playwright (Java)",
  fileExtension: "java",
  generateDeclaration: declaration,
  generateBlock: (elements) => elements.map(declaration).join("\n"),
};
