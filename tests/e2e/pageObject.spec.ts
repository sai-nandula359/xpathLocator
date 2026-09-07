import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { _electron as electron, expect, test, type Page } from "@playwright/test";
import { createSession } from "./helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_URL = pathToFileURL(path.join(__dirname, "..", "fixtures", "login.html")).href;

async function ctrlClickInGuest(window: Page, selector: string) {
  await window.evaluate(async (sel) => {
    const webview = document.querySelector("webview") as unknown as {
      executeJavaScript: (code: string) => Promise<unknown>;
    };
    await webview.executeJavaScript(`
      (function () {
        var el = document.querySelector(${JSON.stringify(sel)});
        if (!el) throw new Error("fixture element not found: " + ${JSON.stringify(sel)});
        var rect = el.getBoundingClientRect();
        var evt = new MouseEvent("click", {
          bubbles: true, cancelable: true, ctrlKey: true,
          clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
        });
        el.dispatchEvent(evt);
      })();
    `);
  }, selector);
}

test.describe("Generate Page Object dialog", () => {
  test("previews a full Page Object class covering every captured element, and copies it", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window = await app.firstWindow();
    const consoleErrors: string[] = [];
    window.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    window.on("pageerror", (err) => consoleErrors.push(String(err)));

    await window.waitForSelector("text=Smart Locator Capture Studio");
    await createSession(window, "Page Object Fixture", FIXTURE_URL);

    await ctrlClickInGuest(window, "#username");
    await window.waitForSelector("text=Captured Elements (1)");
    await ctrlClickInGuest(window, "#loginButton");
    await window.waitForSelector("text=Captured Elements (2)");

    await window.getByTitle("Generate Page Object").click();
    await expect(window.getByText("Generate Page Object")).toBeVisible();

    const preview = window.getByTestId("page-object-preview");
    // Default framework (Selenium Java, the first FRAMEWORKS entry) covers both captured elements.
    await expect(preview).toContainText("public class");
    await expect(preview).toContainText("loginButton");
    await expect(preview).toContainText("username");

    // Switch to Playwright TypeScript and give it a custom class name.
    await window.getByTestId("page-object-class-name").fill("LoginPage");
    await window.getByTestId("page-object-framework-select").selectOption("playwright-ts");
    await expect(preview).toContainText("export class LoginPage {");
    await expect(preview).toContainText("constructor(private readonly page: Page) {}");

    const dialog = window.getByRole("dialog", { name: "Generate Page Object" });
    await dialog.getByRole("button", { name: "Copy", exact: true }).click();
    await window.waitForSelector("text=Page Object copied to clipboard.");
    const clipboardText = await window.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain("export class LoginPage {");

    await window.getByRole("button", { name: "Cancel" }).click();
    await expect(window.getByText("Generate Page Object")).not.toBeVisible();

    expect(consoleErrors, `Console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
    await app.close();
  });

  test("switching scope to Selected narrows the Page Object to just the checked elements", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window = await app.firstWindow();
    await window.waitForSelector("text=Smart Locator Capture Studio");
    await createSession(window, "Page Object Scope Fixture", FIXTURE_URL);

    await ctrlClickInGuest(window, "#username");
    await window.waitForSelector("text=Captured Elements (1)");
    await ctrlClickInGuest(window, "#loginButton");
    await window.waitForSelector("text=Captured Elements (2)");

    const loginRow = window.locator('[data-testid="captured-element-row"]', { hasText: "Login Submit Button" });
    await loginRow.locator('input[type="checkbox"]').check();

    await window.getByTitle("Generate Page Object").click();
    const selectedScopeButton = window.getByRole("button", { name: /^Selected \(1\)$/ });
    await expect(selectedScopeButton).toBeVisible();
    await selectedScopeButton.click();

    const preview = window.getByTestId("page-object-preview");
    await expect(preview).toContainText("loginButton");
    await expect(preview).not.toContainText("username");

    await app.close();
  });
});
