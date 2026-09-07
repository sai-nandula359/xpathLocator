// Shared expression-building for Playwright TypeScript and JavaScript — the two are
// syntactically identical for a locator declaration (no type annotation needed; Playwright's
// Locator type is inferred either way), so playwrightTs.ts and playwrightJs.ts are both thin
// wrappers around this.

import { quoteJs } from "@/engine/codegen/escape";
import { toCamelCase, toPascalCase } from "@/engine/codegen/identifier";
import { pickPlaywrightStrategy } from "@/engine/codegen/playwrightStrategy";
import type { CapturedElement } from "@/types";

export function playwrightExpression(element: CapturedElement): string {
  const strategy = pickPlaywrightStrategy(element);
  switch (strategy.kind) {
    case "testid":
      return `page.getByTestId(${quoteJs(strategy.testId!)})`;
    case "role":
      return `page.getByRole(${quoteJs(strategy.role!)}, { name: ${quoteJs(strategy.name!)} })`;
    case "label":
      return `page.getByLabel(${quoteJs(strategy.name!)})`;
    case "placeholder":
      return `page.getByPlaceholder(${quoteJs(strategy.placeholder!)})`;
    case "text":
      return `page.getByText(${quoteJs(strategy.text!)})`;
    case "locator":
    default:
      return `page.locator(${quoteJs(strategy.locatorValue!)})`;
  }
}

export function playwrightDeclaration(element: CapturedElement): string {
  return `const ${toCamelCase(element.name)} = ${playwrightExpression(element)};`;
}

export function playwrightBlock(elements: CapturedElement[]): string {
  return elements.map(playwrightDeclaration).join("\n");
}

// TS uses a parameter property (`private readonly page: Page`) so the field assignment happens
// as the constructor's first statement — the `readonly xyz = this.page...` field initializers
// below it then see an already-assigned `this.page`, matching Playwright's own documented Page
// Object pattern.
export function playwrightPageObjectTs(className: string, elements: CapturedElement[]): string {
  const name = toPascalCase(className);
  const fields = elements.map((el) => `  readonly ${toCamelCase(el.name)} = this.page.${playwrightExpression(el).slice("page.".length)};`);
  return [`export class ${name} {`, `  constructor(private readonly page: Page) {}`, ``, ...fields, `}`].join("\n");
}

// Plain JS has no parameter-property shorthand, so `this.page` is assigned as an explicit first
// statement in the constructor body instead, with the locators assigned right after it.
export function playwrightPageObjectJs(className: string, elements: CapturedElement[]): string {
  const name = toPascalCase(className);
  const fields = elements.map((el) => `    this.${toCamelCase(el.name)} = ${playwrightExpression(el)};`);
  return [`export class ${name} {`, `  constructor(page) {`, `    this.page = page;`, ...fields, `  }`, `}`].join(
    "\n",
  );
}
