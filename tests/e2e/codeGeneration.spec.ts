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

test.describe("Generated Code panel", () => {
  test("shows a real Playwright locator by default and switches frameworks via the dropdown", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const consoleErrors: string[] = [];
    const window = await app.firstWindow();
    window.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    window.on("pageerror", (err) => consoleErrors.push(String(err)));

    await window.waitForSelector("text=Smart Locator Capture Studio");
    await createSession(window, "Code Generation Fixture", FIXTURE_URL);

    await ctrlClickInGuest(window, "#loginButton");
    await window.waitForSelector("text=Captured Elements (1)");

    // The login button fixture has a data-testid, so the default framework (Selenium Java, the
    // first FRAMEWORKS entry) should key off By.id since id beats data-testid in Selenium's own
    // strategy ordering — just assert the panel renders *something* real rather than pinning the
    // exact default, then drive the framework switch itself.
    const output = window.getByTestId("codegen-output");
    await expect(output).toBeVisible();
    await expect(output).not.toBeEmpty();

    const select = window.getByTestId("codegen-framework-select");
    await select.selectOption("playwright-ts");
    await expect(output).toHaveText(`const loginSubmitButton = page.getByTestId('login-button');`);

    await select.selectOption("cypress");
    await expect(output).toHaveText(`cy.get('[data-testid="login-button"]')`);

    await select.selectOption("robot-framework");
    await expect(output).toHaveText(/\$\{LOGIN_SUBMIT_BUTTON\}\s+id=loginButton/);

    // Copy button writes the currently-shown code to the clipboard.
    await window.getByTitle("Copy generated code").click();
    await window.waitForSelector("text=Copied to clipboard.");
    const clipboardText = await window.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toMatch(/LOGIN_SUBMIT_BUTTON.*id=loginButton/);

    expect(consoleErrors, `Console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
    await app.close();
  });
});
