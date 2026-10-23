import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { createSession } from "./helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OPENER_URL = pathToFileURL(path.join(__dirname, "..", "fixtures", "popup-opener.html")).href;
const TARGET_URL = pathToFileURL(path.join(__dirname, "..", "fixtures", "popup-target.html")).href;

async function clickInGuest(window: Page, selector: string) {
  await window.evaluate(async (sel) => {
    const webview = document.querySelector("webview") as unknown as {
      executeJavaScript: (code: string) => Promise<unknown>;
    };
    await webview.executeJavaScript(`document.querySelector(${JSON.stringify(sel)}).click();`);
  }, selector);
}

async function webviewUrl(window: Page): Promise<string> {
  return window.evaluate(() => (document.querySelector("webview") as unknown as { getURL: () => string }).getURL());
}

async function launch(): Promise<{ app: ElectronApplication; window: Page; consoleErrors: string[] }> {
  const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
  const window = await app.firstWindow();
  const consoleErrors: string[] = [];
  window.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  window.on("pageerror", (err) => consoleErrors.push(String(err)));
  await window.waitForSelector("text=Smart Locator Capture Studio");
  return { app, window, consoleErrors };
}

// Regression guard for "Microsoft login can't be captured": OAuth/SSO popup flows (MSAL's in
// particular) need the *opener* page to stay alive while the popup is open — it polls the popup
// and finishes the sign-in itself once the popup returns to the redirect URI. An earlier version
// loaded the popup's URL into the main webview instead, replacing the opener, so the login could
// never complete. Popups now open as real child windows, leaving the original page untouched, and
// Ctrl+Click capture inside them still reaches the app.
test.describe("popup/window.open handling", () => {
  test("a page calling window.open() opens a child window, keeps the original page, and supports capture inside it", async () => {
    const { app, window, consoleErrors } = await launch();
    await createSession(window, "Popup Window Fixture", OPENER_URL);

    const popupPromise = app.waitForEvent("window");
    await clickInGuest(window, "#openPopup");
    const popup = await popupPromise;
    await popup.waitForURL(TARGET_URL, { timeout: 15000 });

    await expect(popup.locator("#popupHeading")).toHaveText("You are in the popup target");
    // The opener is still loaded in the webview — the popup didn't replace it.
    expect(await webviewUrl(window)).toBe(OPENER_URL);

    await popup.evaluate(() => {
      const el = document.querySelector("#popupHeading")!;
      const rect = el.getBoundingClientRect();
      el.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
        }),
      );
    });
    await window.waitForSelector("text=Captured Elements (1)", { timeout: 15000 });
    await expect(window.locator("code", { hasText: "popupHeading" }).first()).toBeVisible();

    expect(consoleErrors, `Console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
    await app.close();
  });

  // Several SSO/OAuth flows (Microsoft's among them) open a *blank* popup synchronously — to
  // satisfy the popup blocker's user-gesture requirement — then assign the real sign-in URL into
  // it a moment later (`popup.location.href = authUrl`). That assignment needs window.open() to
  // have returned a real window, so the popup must not be denied up front.
  test("a popup opened blank, with its URL assigned a moment later, loads in the child window", async () => {
    const { app, window, consoleErrors } = await launch();
    await createSession(window, "Deferred Popup Fixture", OPENER_URL);

    const popupPromise = app.waitForEvent("window");
    await clickInGuest(window, "#openDeferredPopup");
    const popup = await popupPromise;
    await popup.waitForURL(TARGET_URL, { timeout: 15000 });

    await expect(popup.locator("#popupHeading")).toHaveText("You are in the popup target");
    expect(await webviewUrl(window)).toBe(OPENER_URL);

    expect(consoleErrors, `Console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
    await app.close();
  });
});
