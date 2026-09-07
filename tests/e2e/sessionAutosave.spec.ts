import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { _electron as electron, expect, test, type Page } from "@playwright/test";
import { createSession } from "./helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_A = pathToFileURL(path.join(__dirname, "..", "fixtures", "login.html")).href;
const FIXTURE_B = pathToFileURL(path.join(__dirname, "..", "fixtures", "login-frame.html")).href;

async function ctrlClickInGuest(window: Page, selector: string) {
  await window.evaluate(async (sel) => {
    const webview = document.querySelector("webview") as unknown as {
      executeJavaScript: (code: string) => Promise<unknown>;
    };
    await webview.executeJavaScript(`
      (function () {
        var el = document.querySelector(${JSON.stringify(sel)});
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

// Regression coverage for a real bug: nothing wrote a session to disk except an explicit Ctrl+S
// or the Save button, so a brand-new session didn't exist in the session list until manually
// saved, and switching away from a session silently discarded any captures made since the last
// manual save. Neither step below ever presses Ctrl+S or clicks Save — everything here relies
// entirely on the autosave effect in useCaptureSession.ts.
test.describe("session autosave", () => {
  test("a new session appears on disk immediately, and captures survive a session switch, with no manual save", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window = await app.firstWindow();
    await window.waitForSelector("text=Smart Locator Capture Studio");

    await window.evaluate(async () => {
      const existing = await window.captureStudio.sessions.list();
      await Promise.all(existing.map((s: { id: string }) => window.captureStudio.sessions.delete(s.id)));
    });

    // 1) Creating a session alone (no Ctrl+S) must persist it — this used to require a manual
    // save before the session existed on disk at all.
    await createSession(window, "Autosave Alpha", FIXTURE_A);
    await window.waitForTimeout(600);
    let onDisk = await window.evaluate(async () => {
      const list = await window.captureStudio.sessions.list();
      return list.map((s: { name: string }) => s.name);
    });
    expect(onDisk).toContain("Autosave Alpha");

    // 2) Capturing an element (no Ctrl+S) must also autosave — give the debounce a moment, then
    // check the file on disk directly rather than trusting only in-memory UI state.
    await ctrlClickInGuest(window, "#loginButton");
    await window.waitForSelector("text=Captured Elements (1)");
    await window.waitForTimeout(600);
    let onDiskSummaries = await window.evaluate(() => window.captureStudio.sessions.list());
    let alpha = (onDiskSummaries as { name: string; elementCount: number }[]).find((s) => s.name === "Autosave Alpha");
    expect(alpha?.elementCount).toBe(1);

    // 3) Switching to a different session (no Ctrl+S first) must not lose that capture — this is
    // exactly the "session maintenance" complaint: work made just before switching silently
    // vanishing because nothing flushed it first.
    await createSession(window, "Autosave Beta", FIXTURE_B);
    await window.waitForTimeout(600);

    onDiskSummaries = await window.evaluate(() => window.captureStudio.sessions.list());
    alpha = (onDiskSummaries as { name: string; elementCount: number }[]).find((s) => s.name === "Autosave Alpha");
    expect(alpha?.elementCount).toBe(1);

    await window.locator('button[title^="Current session"]').click();
    await window.getByText("Autosave Alpha", { exact: true }).click();
    await window.waitForSelector("text=Captured Elements (1)");
    await expect(window.getByText(/Login Submit Button/i).first()).toBeVisible();

    await app.close();
  });
});
