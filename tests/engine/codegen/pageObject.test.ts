import { describe, expect, it } from "vitest";
import { cypressGenerator } from "@/engine/codegen/cypress";
import { playwrightJavaGenerator } from "@/engine/codegen/playwrightJava";
import { playwrightJsGenerator } from "@/engine/codegen/playwrightJs";
import { playwrightPythonGenerator } from "@/engine/codegen/playwrightPython";
import { playwrightTsGenerator } from "@/engine/codegen/playwrightTs";
import { robotFrameworkGenerator } from "@/engine/codegen/robotFramework";
import { seleniumCsharpGenerator } from "@/engine/codegen/seleniumCsharp";
import { seleniumJavaGenerator } from "@/engine/codegen/seleniumJava";
import { seleniumPythonGenerator } from "@/engine/codegen/seleniumPython";
import { loginButtonElement, usernameInputElement } from "./fixtures";

const elements = [loginButtonElement(), usernameInputElement()];

describe("Selenium Page Objects", () => {
  it("Java: constructor-injected WebDriver, By fields for every element", () => {
    const src = seleniumJavaGenerator.generatePageObject("login page", elements);
    expect(src).toContain("public class LoginPage {");
    expect(src).toContain("public LoginPage(WebDriver driver)");
    expect(src).toContain('private final By loginSubmitButton = By.id("loginButton");');
    expect(src).toContain('private final By usernameInput = By.name("username");');
  });

  it("Python: __init__(self, driver) with a By tuple per element", () => {
    const src = seleniumPythonGenerator.generatePageObject("LoginPage", elements);
    expect(src).toContain("class LoginPage:");
    expect(src).toContain("def __init__(self, driver):");
    expect(src).toContain('self.login_submit_button = (By.ID, "loginButton")');
    expect(src).toContain('self.username_input = (By.NAME, "username")');
  });

  it("C#: constructor-injected IWebDriver, expression-bodied By properties", () => {
    const src = seleniumCsharpGenerator.generatePageObject("LoginPage", elements);
    expect(src).toContain("public class LoginPage");
    expect(src).toContain("public LoginPage(IWebDriver driver)");
    expect(src).toContain('private By LoginSubmitButton => By.Id("loginButton");');
  });
});

describe("Playwright Page Objects", () => {
  it("TypeScript: parameter-property page field, readonly locator fields built off it", () => {
    const src = playwrightTsGenerator.generatePageObject("LoginPage", elements);
    expect(src).toContain("export class LoginPage {");
    expect(src).toContain("constructor(private readonly page: Page) {}");
    expect(src).toContain("readonly loginSubmitButton = this.page.getByTestId('login-button');");
  });

  it("JavaScript: plain constructor assigning this.page before the locator fields", () => {
    const src = playwrightJsGenerator.generatePageObject("LoginPage", elements);
    expect(src).toContain("export class LoginPage {");
    expect(src).toContain("constructor(page) {");
    expect(src).toContain("this.page = page;");
    expect(src).toContain("this.loginSubmitButton = page.getByTestId('login-button');");
  });

  it("Python: __init__(self, page) storing self.page, locators built off self.page", () => {
    const src = playwrightPythonGenerator.generatePageObject("LoginPage", elements);
    expect(src).toContain("class LoginPage:");
    expect(src).toContain("def __init__(self, page: Page):");
    expect(src).toContain("self.page = page");
    expect(src).toContain("self.login_submit_button = self.page.get_by_test_id('login-button')");
  });

  it("Java: locator fields assigned in the constructor body (not as field initializers) so `page` is never read before it's set", () => {
    const src = playwrightJavaGenerator.generatePageObject("LoginPage", elements);
    expect(src).toContain("public class LoginPage {");
    expect(src).toContain("public final Locator loginSubmitButton;");
    expect(src).toContain("public LoginPage(Page page) {");
    expect(src).toContain("this.page = page;");
    expect(src).toContain('this.loginSubmitButton = page.getByTestId("login-button");');
    // The field declaration and its assignment must not be the same statement (that's exactly
    // the Java field-initializer-runs-before-constructor-body pitfall this generator avoids).
    expect(src).not.toContain('Locator loginSubmitButton = page.getByTestId("login-button");');
  });
});

describe("Cypress Page Object", () => {
  it("exports a singleton instance with a getter per element", () => {
    const src = cypressGenerator.generatePageObject("LoginPage", elements);
    expect(src).toContain("class LoginPage {");
    expect(src).toContain("get loginSubmitButton() {");
    expect(src).toContain('return cy.get(\'[data-testid="login-button"]\');');
    expect(src).toContain("export default new LoginPage();");
  });
});

describe("Robot Framework Page Object", () => {
  it("is a resource-file-shaped *** Variables *** table under a documented page name", () => {
    const src = robotFrameworkGenerator.generatePageObject("LoginPage", elements);
    expect(src).toContain("*** Settings ***");
    expect(src).toContain("Documentation    Page Object: LoginPage");
    expect(src).toContain("*** Variables ***");
    expect(src).toContain("${LOGIN_SUBMIT_BUTTON}    id=loginButton");
  });
});
