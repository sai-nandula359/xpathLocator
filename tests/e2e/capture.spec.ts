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

test.describe("capture golden path", () => {
  test("captures elements with correctly ranked locators, never leaks a password value, and detects duplicates", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const consoleErrors: string[] = [];
    const window = await app.firstWindow();
    window.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    window.on("pageerror", (err) => consoleErrors.push(String(err)));

    await window.waitForSelector("text=Smart Locator Capture Studio");

    // New Session -> fixture URL
    await createSession(window, "Fixture Session", FIXTURE_URL);

    // 1) Capture the login button — expect data-testid as Primary.
    await ctrlClickInGuest(window, "#loginButton");
    await window.waitForSelector("text=Captured Elements (1)");
    await expect(window.getByText(/Login Submit Button/i).first()).toBeVisible();

    const primaryBadge = window.locator("code", { hasText: "login-button" });
    await expect(primaryBadge.first()).toBeVisible();

    // 2) Capture the password field — its value must never appear anywhere in the UI.
    await ctrlClickInGuest(window, "#password");
    await window.waitForSelector("text=Captured Elements (2)");
    await expect(window.locator("body")).not.toContainText("hunter2");

    // 3) Re-capturing the same element should be recognized as a probable duplicate (section 41).
    await ctrlClickInGuest(window, "#loginButton");
    await window.waitForSelector("text=Possible Duplicate Capture");
    await window.getByRole("button", { name: /Create New/i }).click();
    await window.waitForSelector("text=Captured Elements (3)");

    expect(consoleErrors, `Console errors:\n${consoleErrors.join("\n")}`).toEqual([]);

    await app.close();
  });
});
