// section 25 — Selenium Python. Doc examples:
// login_button = (By.ID, "loginButton")
// login_button = (By.XPATH, "//button[@id='loginButton']")

import { escapeDoubleQuoted } from "@/engine/codegen/escape";
import { toPascalCase, toSnakeCase } from "@/engine/codegen/identifier";
import { pickSeleniumStrategy, type SeleniumStrategyKind } from "@/engine/codegen/seleniumStrategy";
import type { CodeGenerator } from "@/engine/codegen/types";
import type { CapturedElement } from "@/types";

const CONSTANT: Record<SeleniumStrategyKind, string> = {
  id: "ID",
  name: "NAME",
  className: "CLASS_NAME",
  linkText: "LINK_TEXT",
  partialLinkText: "PARTIAL_LINK_TEXT",
  css: "CSS_SELECTOR",
  xpath: "XPATH",
};

function byTuple(element: CapturedElement): string {
  const { kind, value } = pickSeleniumStrategy(element);
  return `(By.${CONSTANT[kind]}, "${escapeDoubleQuoted(value)}")`;
}

function declaration(element: CapturedElement): string {
  return `${toSnakeCase(element.name)} = ${byTuple(element)}`;
}

function pageObject(className: string, elements: CapturedElement[]): string {
  const name = toPascalCase(className);
  const fields = elements.map((el) => `        self.${toSnakeCase(el.name)} = ${byTuple(el)}`);
  return [`class ${name}:`, `    def __init__(self, driver):`, `        self.driver = driver`, ...fields].join(
    "\n",
  );
}

export const seleniumPythonGenerator: CodeGenerator = {
  id: "selenium-python",
  label: "Selenium (Python)",
  fileExtension: "py",
  generateDeclaration: declaration,
  generateBlock: (elements) => elements.map(declaration).join("\n"),
  generatePageObject: pageObject,
};
