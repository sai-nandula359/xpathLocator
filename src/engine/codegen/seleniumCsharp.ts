// Selenium C# — not given a literal example in the doc, but follows the same By.* API as Java
// with .NET's PascalCase method naming convention: By.Id(...), By.XPath(...), etc.

import { escapeDoubleQuoted } from "@/engine/codegen/escape";
import { toPascalCase } from "@/engine/codegen/identifier";
import { pickSeleniumStrategy, type SeleniumStrategyKind } from "@/engine/codegen/seleniumStrategy";
import type { CodeGenerator } from "@/engine/codegen/types";
import type { CapturedElement } from "@/types";

const METHOD: Record<SeleniumStrategyKind, string> = {
  id: "Id",
  name: "Name",
  className: "ClassName",
  linkText: "LinkText",
  partialLinkText: "PartialLinkText",
  css: "CssSelector",
  xpath: "XPath",
};

function byExpression(element: CapturedElement): string {
  const { kind, value } = pickSeleniumStrategy(element);
  return `By.${METHOD[kind]}("${escapeDoubleQuoted(value)}")`;
}

function declaration(element: CapturedElement): string {
  return `By ${toPascalCase(element.name)} = ${byExpression(element)};`;
}

function pageObject(className: string, elements: CapturedElement[]): string {
  const name = toPascalCase(className);
  const properties = elements.map(
    (el) => `    private By ${toPascalCase(el.name)} => ${byExpression(el)};`,
  );
  return [
    `public class ${name}`,
    `{`,
    `    private readonly IWebDriver driver;`,
    ``,
    `    public ${name}(IWebDriver driver)`,
    `    {`,
    `        this.driver = driver;`,
    `    }`,
    ``,
    ...properties,
    `}`,
  ].join("\n");
}

export const seleniumCsharpGenerator: CodeGenerator = {
  id: "selenium-csharp",
  label: "Selenium (C#)",
  fileExtension: "cs",
  generateDeclaration: declaration,
  generateBlock: (elements) => elements.map(declaration).join("\n"),
  generatePageObject: pageObject,
};
