// section 25's Selenium Python naming convention (snake_case) applied to Playwright's own
// Python API, which mirrors the JS one with snake_case method names: get_by_test_id,
// get_by_role(role, name=...), get_by_placeholder, get_by_text, get_by_label, locator.

import { quotePy } from "@/engine/codegen/escape";
import { toPascalCase, toSnakeCase } from "@/engine/codegen/identifier";
import { pickPlaywrightStrategy } from "@/engine/codegen/playwrightStrategy";
import type { CodeGenerator } from "@/engine/codegen/types";
import type { CapturedElement } from "@/types";

function expression(element: CapturedElement): string {
  const strategy = pickPlaywrightStrategy(element);
  switch (strategy.kind) {
    case "testid":
      return `page.get_by_test_id(${quotePy(strategy.testId!)})`;
    case "role":
      return `page.get_by_role(${quotePy(strategy.role!)}, name=${quotePy(strategy.name!)})`;
    case "label":
      return `page.get_by_label(${quotePy(strategy.name!)})`;
    case "placeholder":
      return `page.get_by_placeholder(${quotePy(strategy.placeholder!)})`;
    case "text":
      return `page.get_by_text(${quotePy(strategy.text!)})`;
    case "locator":
    default:
      return `page.locator(${quotePy(strategy.locatorValue!)})`;
  }
}

function declaration(element: CapturedElement): string {
  return `${toSnakeCase(element.name)} = ${expression(element)}`;
}

function pageObject(className: string, elements: CapturedElement[]): string {
  const name = toPascalCase(className);
  const fields = elements.map(
    (el) => `        self.${toSnakeCase(el.name)} = self.page.${expression(el).slice("page.".length)}`,
  );
  return [`class ${name}:`, `    def __init__(self, page: Page):`, `        self.page = page`, ...fields].join(
    "\n",
  );
}

export const playwrightPythonGenerator: CodeGenerator = {
  id: "playwright-python",
  label: "Playwright (Python)",
  fileExtension: "py",
  generateDeclaration: declaration,
  generateBlock: (elements) => elements.map(declaration).join("\n"),
  generatePageObject: pageObject,
};
