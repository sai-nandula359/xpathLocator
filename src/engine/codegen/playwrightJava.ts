// Playwright Java — not given a literal example in the doc, but follows Playwright's real Java
// API: locators return a `Locator`, and getByRole takes an AriaRole enum constant plus an
// options object rather than a plain string (unlike the JS/Python/TS bindings) —
// page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Login")).

import { escapeDoubleQuoted } from "@/engine/codegen/escape";
import { toCamelCase, toPascalCase } from "@/engine/codegen/identifier";
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

// Locator fields are assigned in the constructor *body*, not as field initializers — Java runs
// field initializers before any explicit constructor-body statements, so an initializer
// referencing the `page` field directly (e.g. `Locator x = page.getByTestId(...)`) would see it
// as still null at that point. Assigning `this.page` first, then the locator fields right after
// it in the constructor body, avoids that ordering pitfall.
function pageObject(className: string, elements: CapturedElement[]): string {
  const name = toPascalCase(className);
  const fieldDecls = elements.map((el) => `    public final Locator ${toCamelCase(el.name)};`);
  const assignments = elements.map((el) => `        this.${toCamelCase(el.name)} = ${expression(el)};`);
  return [
    `public class ${name} {`,
    `    private final Page page;`,
    ...fieldDecls,
    ``,
    `    public ${name}(Page page) {`,
    `        this.page = page;`,
    ...assignments,
    `    }`,
    `}`,
  ].join("\n");
}

export const playwrightJavaGenerator: CodeGenerator = {
  id: "playwright-java",
  label: "Playwright (Java)",
  fileExtension: "java",
  generateDeclaration: declaration,
  generateBlock: (elements) => elements.map(declaration).join("\n"),
  generatePageObject: pageObject,
};
