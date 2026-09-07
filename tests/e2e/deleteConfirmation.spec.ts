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

// Regression coverage for the "one misclick loses your work" gap: deleting a captured element
// (via its row's X button, or the Delete key) used to happen instantly with no way back.
test.describe("delete confirmation", () => {
  test("dismissing the confirm dialog keeps the element; accepting it removes it", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window = await app.firstWindow();
    await window.waitForSelector("text=Smart Locator Capture Studio");
    await createSession(window, "Delete Confirmation Fixture", FIXTURE_URL);

    await ctrlClickInGuest(window, "#loginButton");
    await window.waitForSelector("text=Captured Elements (1)");

    const row = window.locator('[data-testid="captured-element-row"]', { hasText: "Login Submit Button" });
    const deleteButton = row.getByTitle("Delete");
    await row.hover();

    // Dismiss — the element must still be there.
    window.once("dialog", (dialog) => void dialog.dismiss());
    await deleteButton.click();
    await expect(window.getByText("Captured Elements (1)")).toBeVisible();
    await expect(row).toBeVisible();

    // Accept — now it's actually removed.
    window.once("dialog", (dialog) => void dialog.accept());
    await row.hover();
    await deleteButton.click();
    await expect(window.getByText("Captured Elements (0)")).toBeVisible();

    await app.close();
  });

  test("the Delete key shortcut also confirms before removing the selected element", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window = await app.firstWindow();
    await window.waitForSelector("text=Smart Locator Capture Studio");
    await createSession(window, "Delete Key Fixture", FIXTURE_URL);

    await ctrlClickInGuest(window, "#loginButton");
    await window.waitForSelector("text=Captured Elements (1)");

    window.once("dialog", (dialog) => void dialog.dismiss());
    await window.keyboard.press("Delete");
    await expect(window.getByText("Captured Elements (1)")).toBeVisible();

    window.once("dialog", (dialog) => void dialog.accept());
    await window.keyboard.press("Delete");
    await expect(window.getByText("Captured Elements (0)")).toBeVisible();

    await app.close();
  });
});
