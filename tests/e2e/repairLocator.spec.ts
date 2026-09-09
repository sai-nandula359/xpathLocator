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

async function runInGuest(window: Page, code: string) {
  await window.evaluate(async (js) => {
    const webview = document.querySelector("webview") as unknown as {
      executeJavaScript: (code: string) => Promise<unknown>;
    };
    await webview.executeJavaScript(js);
  }, code);
}

test.describe("Locator Repair", () => {
  test("promotes the id-based candidate to Primary after a deploy drops data-testid off the live element", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window = await app.firstWindow();
    const consoleErrors: string[] = [];
    window.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    window.on("pageerror", (err) => consoleErrors.push(String(err)));

    await window.waitForSelector("text=Smart Locator Capture Studio");
    await createSession(window, "Repair Fixture", FIXTURE_URL);

    await ctrlClickInGuest(window, "#loginButton");
    await window.waitForSelector("text=Captured Elements (1)");

    // Primary starts out keyed on data-testid — the strongest available signal.
    const primaryBadgeBefore = window.locator("code", { hasText: "login-button" }).first();
    await expect(primaryBadgeBefore).toBeVisible();

    // Simulate a deploy that drops the data-testid attribute from the live page — the id is
    // still there, so the id-based candidate already generated at capture time should still work.
    await runInGuest(window, `document.querySelector('#loginButton').removeAttribute('data-testid');`);

    await window.getByTitle(/Re-validate every candidate/).click();
    await window.waitForSelector("text=/Primary locator was broken/");

    // The primary-highlighted candidate (blue border) now shows the id-based locator instead.
    const primaryCard = window.locator('[class*="border-blue-300"]').first();
    await expect(primaryCard).toContainText("loginButton");
    await expect(primaryCard).not.toContainText("login-button");
    await expect(primaryCard).toContainText("Unique");

    expect(consoleErrors, `Console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
    await app.close();
  });

  test("reports no repair needed when the Primary is still valid", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window = await app.firstWindow();
    await window.waitForSelector("text=Smart Locator Capture Studio");
    await createSession(window, "Repair No-Op Fixture", FIXTURE_URL);

    await ctrlClickInGuest(window, "#loginButton");
    await window.waitForSelector("text=Captured Elements (1)");

    await window.getByTitle(/Re-validate every candidate/).click();
    await window.waitForSelector("text=Primary locator is already valid — no repair needed.");

    await app.close();
  });
});
