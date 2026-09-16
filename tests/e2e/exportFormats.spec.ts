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

// Never actually clicks "Export": dialog.showSaveDialog() is a real, blocking native OS dialog
// Playwright can't drive, so every export E2E test in this suite (see selectAll.spec.ts) only
// verifies the in-app dialog state up to that point, matching the established pattern here.
test.describe("Markdown and Excel export", () => {
  test("both new formats are selectable and enable the Export button", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window = await app.firstWindow();
    const consoleErrors: string[] = [];
    window.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    window.on("pageerror", (err) => consoleErrors.push(String(err)));

    await window.waitForSelector("text=Smart Locator Capture Studio");
    await createSession(window, "Export Formats Fixture", FIXTURE_URL);
    await ctrlClickInGuest(window, "#loginButton");
    await window.waitForSelector("text=Captured Elements (1)");

    await window.getByTitle("Export (Ctrl+E)", { exact: true }).click();
    await expect(window.getByText("Export Session")).toBeVisible();

    const exportButton = window.getByRole("button", { name: "Export", exact: true });

    await window.getByRole("button", { name: "MD", exact: true }).click();
    await expect(exportButton).toBeEnabled();

    await window.getByRole("button", { name: "XLSX", exact: true }).click();
    await expect(exportButton).toBeEnabled();

    await window.getByRole("button", { name: "Cancel" }).click();
    await expect(window.getByText("Export Session")).not.toBeVisible();

    expect(consoleErrors, `Console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
    await app.close();
  });
});
