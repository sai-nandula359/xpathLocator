import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { _electron as electron, expect, test } from "@playwright/test";
import { createSession } from "./helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_A = pathToFileURL(path.join(__dirname, "..", "fixtures", "login.html")).href;
const FIXTURE_B = pathToFileURL(path.join(__dirname, "..", "fixtures", "login-frame.html")).href;

test.describe("session dropdown", () => {
  test("creates, lists, switches between, and deletes sessions from a single header control", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window = await app.firstWindow();
    await window.waitForSelector("text=Smart Locator Capture Studio");

    // This suite writes real session files to the app's actual userData folder (there's no
    // isolated per-run profile) — clear out anything left behind by earlier runs so "Alpha"/
    // "Beta" are guaranteed unique for the assertions below.
    await window.evaluate(async () => {
      const existing = await window.captureStudio.sessions.list();
      await Promise.all(existing.map((s: { id: string }) => window.captureStudio.sessions.delete(s.id)));
    });

    const trigger = window.locator('button[title^="Current session"]');

    // Create + save "Alpha".
    await createSession(window, "Alpha", FIXTURE_A);
    await expect(trigger).toContainText("Alpha");
    await window.keyboard.press("Control+S");
    await window.waitForTimeout(600);

    // Create + save "Beta" via the dropdown's own "New Session" entry.
    await createSession(window, "Beta", FIXTURE_B);
    await expect(trigger).toContainText("Beta");
    await window.keyboard.press("Control+S");
    await window.waitForTimeout(600);

    // The trigger shows the most-recently-created session by default, and the panel lists both.
    // "Beta" matches both the trigger label (already showing it) and its own list row here, so
    // scope to the row specifically — it's the one rendered after the trigger in DOM order.
    await trigger.click();
    await expect(window.getByText("Alpha", { exact: true })).toBeVisible();
    await expect(window.getByText("Beta", { exact: true }).last()).toBeVisible();

    // Switching to "Alpha" from the list actually navigates the browser.
    await window.getByText("Alpha", { exact: true }).click();
    await window.waitForFunction(
      (url) => {
        const wv = document.querySelector("webview") as unknown as { getURL?: () => string } | null;
        return !!wv?.getURL && wv.getURL() === url;
      },
      FIXTURE_A,
      { timeout: 15000 },
    );
    await expect(trigger).toContainText("Alpha");

    // Deleting "Beta" from the list removes it from disk — checked via listSessions(), not page
    // text (the active session's own label can coincidentally contain the same text).
    await trigger.click();
    window.once("dialog", (dialog) => void dialog.accept());
    await window.locator('button[title="Delete this saved session"]').first().click();
    await window.waitForTimeout(800);

    const remaining = await window.evaluate(async () => {
      const list = await window.captureStudio.sessions.list();
      return list.map((s: { name: string }) => s.name);
    });
    expect(remaining).toContain("Alpha");
    expect(remaining).not.toContain("Beta");

    await app.close();
  });

  // Never actually clicked: it triggers a real, blocking native OS open-file dialog Playwright
  // can't drive (same constraint documented in exportFormats.spec.ts for the save dialog) — the
  // actual parse/reconstruct logic behind it is covered directly in tests/import/*.test.ts.
  test("Import Session… is available from the same dropdown as New Session", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window = await app.firstWindow();
    await window.waitForSelector("text=Smart Locator Capture Studio");

    await window.locator('button[title^="Current session"]').click();
    await expect(window.getByRole("button", { name: "Import Session…" })).toBeVisible();
    await expect(window.getByRole("button", { name: "New Session" })).toBeVisible();

    await app.close();
  });
});
