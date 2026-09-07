import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { _electron as electron, expect, test, type Page } from "@playwright/test";
import { createSession } from "./helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_URL = pathToFileURL(path.join(__dirname, "..", "fixtures", "duplicate-widgets.html")).href;

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

test.describe("custom locator builder", () => {
  test("combining two non-unique attributes produces a unique locator the automatic pipeline didn't find", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window = await app.firstWindow();
    const consoleErrors: string[] = [];
    window.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    window.on("pageerror", (err) => consoleErrors.push(String(err)));

    await window.waitForSelector("text=Smart Locator Capture Studio");
    await createSession(window, "Custom Locator Fixture", FIXTURE_URL);

    // class="action-btn" matches 2 buttons, data-row="1" also matches 2 (a different pair) —
    // neither the automatic pipeline's type+name/type+class combination generator nor any plain
    // attribute candidate resolves this on its own; only combining class AND data-row does.
    await ctrlClickInGuest(window, 'button[data-row="1"].action-btn');
    await window.waitForSelector("text=Captured Elements (1)");

    await window.getByTitle("Manually pick attributes to build a custom locator").click();
    const dialog = window.getByRole("dialog", { name: "Build Custom Locator" });
    await expect(dialog).toBeVisible();

    await dialog.locator("label", { hasText: "@class" }).locator('input[type="checkbox"]').check();
    await expect(dialog.getByText(/2 matches.*Non-Unique/)).toBeVisible();

    await dialog.locator("label", { hasText: "@data-row" }).locator('input[type="checkbox"]').check();
    await expect(dialog.getByText(/1 match.*Unique/)).toBeVisible();

    const addButton = dialog.getByRole("button", { name: "Add as Candidate" });
    await expect(addButton).toBeEnabled();
    await addButton.click();

    await expect(dialog).not.toBeVisible();
    // Appears twice when it wins Primary — once in the captured-elements row preview, once in
    // the details panel's own candidate card — so this also incidentally confirms the manually
    // built candidate outranked the automatic (indexed/absolute) candidates and became Primary.
    await expect(window.locator("code", { hasText: "@class='action-btn' and @data-row='1'" }).first()).toBeVisible();

    expect(consoleErrors, `Console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
    await app.close();
  });

  test("wrap-with-position resolves two fully identical elements that share every attribute", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window = await app.firstWindow();

    await window.waitForSelector("text=Smart Locator Capture Studio");
    await createSession(window, "Position Wrap Fixture", FIXTURE_URL);

    await ctrlClickInGuest(window, ".dup-input");
    await window.waitForSelector("text=Captured Elements (1)");

    await window.getByTitle("Manually pick attributes to build a custom locator").click();
    const dialog = window.getByRole("dialog", { name: "Build Custom Locator" });
    await expect(dialog).toBeVisible();

    await dialog.locator("label", { hasText: "@class" }).locator('input[type="checkbox"]').check();
    await expect(dialog.getByText(/2 matches.*Non-Unique/)).toBeVisible();

    await dialog.getByText("Wrap with position (fragile)").click();
    await expect(dialog.getByText(/1 match.*Unique/)).toBeVisible();
    await expect(dialog.locator("code", { hasText: /\)\[\d\]$/ })).toBeVisible();

    const addButton = dialog.getByRole("button", { name: "Add as Candidate" });
    await expect(addButton).toBeEnabled();
    await addButton.click();
    await expect(dialog).not.toBeVisible();

    await app.close();
  });
});
