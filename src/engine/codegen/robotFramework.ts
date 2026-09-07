// section 26 — Robot Framework (SeleniumLibrary locator syntax). Doc example:
// ${LOGIN_BUTTON}    xpath=//button[@id='loginButton']

import { toUpperSnakeCase } from "@/engine/codegen/identifier";
import { pickSeleniumStrategy, type SeleniumStrategyKind } from "@/engine/codegen/seleniumStrategy";
import type { CodeGenerator } from "@/engine/codegen/types";
import type { CapturedElement } from "@/types";

// SeleniumLibrary's locator-strategy prefixes — className has no direct prefix, but "css=.foo"
// is the documented equivalent; linkText maps to "link=" (exact match, matching Selenium's own
// By.linkText semantics rather than "partial link=").
const STRATEGY_PREFIX: Record<SeleniumStrategyKind, string> = {
  id: "id",
  name: "name",
  className: "css",
  linkText: "link",
  css: "css",
  xpath: "xpath",
};

function locatorValue(kind: SeleniumStrategyKind, value: string): string {
  return kind === "className" ? `.${value}` : value;
}

function declaration(element: CapturedElement): string {
  const { kind, value } = pickSeleniumStrategy(element);
  const varName = toUpperSnakeCase(element.name);
  const locator = `${STRATEGY_PREFIX[kind]}=${locatorValue(kind, value)}`;
  return `\${${varName}}    ${locator}`;
}

// Robot Framework has no class construct of its own — its equivalent of a Page Object is a
// resource file: a *** Variables *** table of locators (exactly what generateBlock already
// produces) under a documented *** Settings *** header naming the page, importable into any
// .robot test suite via `Resource    LoginPage.resource`.
function pageObject(className: string, elements: CapturedElement[]): string {
  return [
    "*** Settings ***",
    `Documentation    Page Object: ${className}`,
    "",
    "*** Variables ***",
    ...elements.map(declaration),
  ].join("\n");
}

export const robotFrameworkGenerator: CodeGenerator = {
  id: "robot-framework",
  label: "Robot Framework",
  fileExtension: "robot",
  generateDeclaration: declaration,
  generateBlock: (elements) => {
    const lines = ["*** Variables ***", ...elements.map(declaration)];
    return lines.join("\n");
  },
  generatePageObject: pageObject,
};
