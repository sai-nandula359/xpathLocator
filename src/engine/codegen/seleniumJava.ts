// section 24 — Selenium Java. Doc examples:
// By loginButton = By.id("loginButton");
// By loginButton = By.xpath("//button[@id='loginButton']");

import { escapeDoubleQuoted } from "@/engine/codegen/escape";
import { toCamelCase } from "@/engine/codegen/identifier";
import { pickSeleniumStrategy, type SeleniumStrategyKind } from "@/engine/codegen/seleniumStrategy";
import type { CodeGenerator } from "@/engine/codegen/types";
import type { CapturedElement } from "@/types";

const METHOD: Record<SeleniumStrategyKind, string> = {
  id: "id",
  name: "name",
  className: "className",
  linkText: "linkText",
  css: "cssSelector",
  xpath: "xpath",
};

function byExpression(element: CapturedElement): string {
  const { kind, value } = pickSeleniumStrategy(element);
  return `By.${METHOD[kind]}("${escapeDoubleQuoted(value)}")`;
}

function declaration(element: CapturedElement): string {
  return `By ${toCamelCase(element.name)} = ${byExpression(element)};`;
}

export const seleniumJavaGenerator: CodeGenerator = {
  id: "selenium-java",
  label: "Selenium (Java)",
  fileExtension: "java",
  generateDeclaration: declaration,
  generateBlock: (elements) => elements.map(declaration).join("\n"),
};
