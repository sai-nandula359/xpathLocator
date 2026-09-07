import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { _electron as electron, expect, test } from "@playwright/test";
import { createSession } from "./helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_A = pathToFileURL(path.join(__dirname, "..", "fixtures", "login.html")).href;

test.describe("session navigation", () => {
  test("creating a new session whose URL matches the currently-loaded one still forces a reload", async () => {
    // Regression test: React's <webview src> prop only updates the DOM attribute when its
    // *value* changes. If a new session's starting URL happens to equal whatever's already
    // loaded (e.g. re-testing the same site), that value never changes, so nothing told the
    // webview to reload — the session's own data (name, captured elements) reset correctly, but
    // the browser content silently stayed on whatever page it was already showing, which read
    // as "New Session did nothing." See BrowserWorkspace.tsx's session-navigation effect.
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window = await app.firstWindow();
    const consoleErrors: string[] = [];
    window.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    window.on("pageerror", (err) => consoleErrors.push(String(err)));

    await window.waitForSelector("text=Smart Locator Capture Studio");

    await createSession(window, "First", FIXTURE_A);

    // Mutate the live page so a real reload is distinguishable from "nothing happened".
    await window.evaluate(async () => {
      const webview = document.querySelector("webview") as unknown as {
        executeJavaScript: (c: string) => Promise<unknown>;
      };
      await webview.executeJavaScript(`document.title = "MODIFIED STATE"; "ok"`);
    });
    await window.waitForTimeout(500);

    await window.locator('button[title^="Current session"]').click();
    await window.getByRole("button", { name: "New Session" }).click();
    await window.getByLabel("Session Name").fill("Second Same URL");
    await window.getByLabel("Starting URL").fill(FIXTURE_A);
    await window.getByRole("button", { name: "Create" }).click();
    await window.waitForTimeout(2500);

    const title = await window.evaluate(async () => {
      const webview = document.querySelector("webview") as unknown as {
        executeJavaScript: (c: string) => Promise<unknown>;
      };
      return await webview.executeJavaScript("document.title");
    });
    expect(title).toBe("Fixture Login Page");

    const headerText = await window.locator("header").innerText();
    expect(headerText).toContain("SECOND SAME URL");

    // The fix must not race against React's own src-attribute-driven navigation for the normal
    // (URL actually changed) case — that race previously surfaced as a benign ERR_ABORTED.
    expect(consoleErrors).toEqual([]);

    await app.close();
  });
});
