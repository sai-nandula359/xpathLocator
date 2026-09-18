import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { _electron as electron, expect, test } from "@playwright/test";
import { createSession } from "./helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_URL = pathToFileURL(path.join(__dirname, "..", "fixtures", "login.html")).href;

test.describe("shared Modal — focus management and dismissal (src/components/Modal.tsx)", () => {
  test("opening a dialog moves focus inside it, Tab wraps around, closing restores focus to the trigger, and clicking the backdrop dismisses it", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window = await app.firstWindow();
    const consoleErrors: string[] = [];
    window.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    window.on("pageerror", (err) => consoleErrors.push(String(err)));

    await window.waitForSelector("text=Smart Locator Capture Studio");
    await createSession(window, "Modal Accessibility Fixture", FIXTURE_URL);

    const exportTrigger = window.getByTitle("Export (Ctrl+E)", { exact: true });
    await exportTrigger.click();

    const dialog = window.getByRole("dialog", { name: "Export Session" });
    await expect(dialog).toBeVisible();

    // Focus landed on something inside the dialog, not left on the page behind it.
    const activeIsInsideDialog = await window.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]');
      return !!dlg && dlg.contains(document.activeElement);
    });
    expect(activeIsInsideDialog).toBe(true);

    // Shift+Tab from the first focusable element wraps around to the last one, rather than
    // leaving the dialog into the page behind it.
    const firstFocusedTag = await window.evaluate(() => document.activeElement?.outerHTML.slice(0, 60));
    await window.keyboard.press("Shift+Tab");
    const afterWrapTag = await window.evaluate(() => document.activeElement?.outerHTML.slice(0, 60));
    expect(afterWrapTag).not.toBe(firstFocusedTag);
    const stillInsideAfterWrap = await window.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]');
      return !!dlg && dlg.contains(document.activeElement);
    });
    expect(stillInsideAfterWrap).toBe(true);

    await window.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).not.toBeVisible();

    // Focus returned to whatever triggered the dialog, not left on <body>.
    const restoredToTrigger = await window.evaluate(
      () => document.activeElement?.getAttribute("title") === "Export (Ctrl+E)",
    );
    expect(restoredToTrigger).toBe(true);

    // Clicking the dark backdrop (outside the panel) also dismisses the dialog.
    await exportTrigger.click();
    await expect(dialog).toBeVisible();
    await window.mouse.click(5, 5); // top-left corner — backdrop, not the centered panel
    await expect(dialog).not.toBeVisible();

    expect(consoleErrors, `Console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
    await app.close();
  });
});
