// Shared expression-building for Playwright TypeScript and JavaScript — the two are
// syntactically identical for a locator declaration (no type annotation needed; Playwright's
// Locator type is inferred either way), so playwrightTs.ts and playwrightJs.ts are both thin
// wrappers around this.

import { quoteJs } from "@/engine/codegen/escape";
import { toCamelCase } from "@/engine/codegen/identifier";
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
