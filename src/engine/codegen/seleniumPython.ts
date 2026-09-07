// section 25 — Selenium Python. Doc examples:
// login_button = (By.ID, "loginButton")
// login_button = (By.XPATH, "//button[@id='loginButton']")

import { escapeDoubleQuoted } from "@/engine/codegen/escape";
import { toSnakeCase } from "@/engine/codegen/identifier";
import { pickSeleniumStrategy, type SeleniumStrategyKind } from "@/engine/codegen/seleniumStrategy";
import type { CodeGenerator } from "@/engine/codegen/types";
import type { CapturedElement } from "@/types";

const CONSTANT: Record<SeleniumStrategyKind, string> = {
  id: "ID",
  name: "NAME",
  className: "CLASS_NAME",
  linkText: "LINK_TEXT",
  css: "CSS_SELECTOR",
  xpath: "XPATH",
};

function declaration(element: CapturedElement): string {
  const { kind, value } = pickSeleniumStrategy(element);
  return `${toSnakeCase(element.name)} = (By.${CONSTANT[kind]}, "${escapeDoubleQuoted(value)}")`;
}

export const seleniumPythonGenerator: CodeGenerator = {
  id: "selenium-python",
  label: "Selenium (Python)",
  fileExtension: "py",
  generateDeclaration: declaration,
  generateBlock: (elements) => elements.map(declaration).join("\n"),
};
