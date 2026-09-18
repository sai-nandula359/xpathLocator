// section 24 — Selenium Java. Doc examples:
// By loginButton = By.id("loginButton");
// By loginButton = By.xpath("//button[@id='loginButton']");

import { escapeDoubleQuoted } from "@/engine/codegen/escape";
import { toCamelCase, toPascalCase } from "@/engine/codegen/identifier";
import { pickSeleniumStrategy, type SeleniumStrategyKind } from "@/engine/codegen/seleniumStrategy";
import type { CodeGenerator } from "@/engine/codegen/types";
import type { CapturedElement } from "@/types";

const METHOD: Record<SeleniumStrategyKind, string> = {
  id: "id",
  name: "name",
  className: "className",
  linkText: "linkText",
  partialLinkText: "partialLinkText",
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

function pageObject(className: string, elements: CapturedElement[]): string {
  const name = toPascalCase(className);
  const fields = elements.map((el) => `    private final By ${toCamelCase(el.name)} = ${byExpression(el)};`);
  return [
    `public class ${name} {`,
    `    private final WebDriver driver;`,
    ``,
    `    public ${name}(WebDriver driver) {`,
    `        this.driver = driver;`,
    `    }`,
    ``,
    ...fields,
    `}`,
  ].join("\n");
}

export const seleniumJavaGenerator: CodeGenerator = {
  id: "selenium-java",
  label: "Selenium (Java)",
  fileExtension: "java",
  generateDeclaration: declaration,
  generateBlock: (elements) => elements.map(declaration).join("\n"),
  generatePageObject: pageObject,
};
