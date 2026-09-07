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

test.describe("captured elements — select all", () => {
  test("select-all checkbox checks/unchecks every visible row and drives bulk delete", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window = await app.firstWindow();
    const consoleErrors: string[] = [];
    window.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    window.on("pageerror", (err) => consoleErrors.push(String(err)));

    await window.waitForSelector("text=Smart Locator Capture Studio");
    // Session name deliberately avoids action words ("select", "export", "all") that appear in
    // the UI's own controls — the header's session-switcher button title/label embeds the
    // session name, so a name containing one of those words collides with locators for the
    // control itself.
    await createSession(window, "Bulk Checkbox Fixture", FIXTURE_URL);

    await ctrlClickInGuest(window, "#username");
    await window.waitForSelector("text=Captured Elements (1)");
    await ctrlClickInGuest(window, "#password");
    await window.waitForSelector("text=Captured Elements (2)");
    await ctrlClickInGuest(window, "#loginButton");
    await window.waitForSelector("text=Captured Elements (3)");

    const selectAll = window.getByTestId("select-all-checkbox");
    await expect(selectAll).toBeVisible();

    // No row checked yet — the master checkbox reads unchecked, not indeterminate.
    await expect(selectAll).not.toBeChecked();

    await selectAll.check();
    await expect(window.getByText("Delete 3")).toBeVisible();

    // Toggling it again clears every row's selection.
    await selectAll.uncheck();
    await expect(window.getByText(/Delete \d/)).not.toBeVisible();

    // Re-check via select-all, then delete everything through the bulk action.
    await selectAll.check();
    await window.getByText("Delete 3").click();
    await expect(window.getByText("Captured Elements (0)")).toBeVisible();
    await expect(window.getByText("Ctrl+Click an element in the browser to capture it.")).toBeVisible();

    expect(consoleErrors, `Console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
    await app.close();
  });

  test("a checkbox selection made in Captured Elements carries into the Export dialog's Selected scope", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window = await app.firstWindow();

    await window.waitForSelector("text=Smart Locator Capture Studio");
    await createSession(window, "Bulk Checkbox Fixture Two", FIXTURE_URL);

    await ctrlClickInGuest(window, "#username");
    await window.waitForSelector("text=Captured Elements (1)");
    await ctrlClickInGuest(window, "#loginButton");
    await window.waitForSelector("text=Captured Elements (2)");

    // Select all, then uncheck one — leaving exactly one element checked. Scoped to captured
    // rows specifically (data-testid) rather than plain text, since "Login Submit Button" also
    // appears as the heading in the Locator Details panel once that element is auto-selected.
    await window.getByTestId("select-all-checkbox").check();
    const loginRow = window.locator('[data-testid="captured-element-row"]', { hasText: "Login Submit Button" });
    await loginRow.locator('input[type="checkbox"]').uncheck();

    await window.getByTitle("Export (Ctrl+E)", { exact: true }).click();
    await expect(window.getByText("Export Session")).toBeVisible();

    const selectedScopeButton = window.getByRole("button", { name: /^Selected \(1\)$/ });
    await expect(selectedScopeButton).toBeVisible();
    // Defaults to "selected" (highlighted) since a checkbox selection already existed when the
    // dialog opened — the export button must be enabled for that default scope right away.
    await expect(window.getByRole("button", { name: "Export", exact: true })).toBeEnabled();

    await window.getByRole("button", { name: "Cancel" }).click();
    await expect(window.getByText("Export Session")).not.toBeVisible();

    await app.close();
  });
});
