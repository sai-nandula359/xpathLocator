import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { _electron as electron, expect, test } from "@playwright/test";
import { createSession } from "./helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OPENER_URL = pathToFileURL(path.join(__dirname, "..", "fixtures", "popup-opener.html")).href;
const TARGET_URL = pathToFileURL(path.join(__dirname, "..", "fixtures", "popup-target.html")).href;

// Regression guard for "Microsoft/any login not opening": many OAuth/SSO flows use
// window.open()/target="_blank" rather than a same-window redirect. The <webview> has
// `allowpopups` set; without electron/main.cjs's setWindowOpenHandler, Electron's documented
// default is to open the popup as a bare, separate BrowserWindow outside this app's UI/partition
// entirely — invisible to the user, and unusable for the capture workflow either way. The fix
// denies the popup and loads its URL into the same, visible webview instead.
test.describe("popup/window.open redirect handling", () => {
  test("a page calling window.open() navigates the existing webview instead of spawning a separate window", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window = await app.firstWindow();
    const consoleErrors: string[] = [];
    window.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    window.on("pageerror", (err) => consoleErrors.push(String(err)));

    await window.waitForSelector("text=Smart Locator Capture Studio");
    await createSession(window, "Popup Redirect Fixture", OPENER_URL);

    // app.windows() includes the <webview> guest's own page alongside the host BrowserWindow, so
    // the baseline is 2, not 1 — what matters is that clicking the popup button doesn't add a
    // THIRD one (a separate, untracked BrowserWindow for the popup).
    const windowCountBefore = app.windows().length;

    await window.evaluate(async () => {
      const webview = document.querySelector("webview") as unknown as {
        executeJavaScript: (code: string) => Promise<unknown>;
      };
      await webview.executeJavaScript(`
        (function () {
          var btn = document.querySelector("#openPopup");
          btn.click();
        })();
      `);
    });

    await window.waitForFunction(
      (expectedUrl) => {
        const wv = document.querySelector("webview") as unknown as { getURL?: () => string } | null;
        return !!wv?.getURL && wv.getURL() === expectedUrl;
      },
      TARGET_URL,
      { timeout: 15000 },
    );

    // The popup's own content loaded, but in the same visible webview — not a second window.
    await expect(window.evaluate(async () => {
      const webview = document.querySelector("webview") as unknown as {
        executeJavaScript: (code: string) => Promise<unknown>;
      };
      return webview.executeJavaScript("document.getElementById('popupHeading') ? document.getElementById('popupHeading').textContent : null");
    })).resolves.toBe("You are in the popup target");

    expect(app.windows()).toHaveLength(windowCountBefore);

    expect(consoleErrors, `Console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
    await app.close();
  });

  // Regression test for the real-world report this was actually caught against: several SSO/OAuth
  // flows (Microsoft's among them) open a *blank* popup synchronously — to satisfy the popup
  // blocker's user-gesture requirement — then assign the real sign-in URL into it a moment later
  // (`popup.location.href = authUrl`), often after an async call. Denying the popup immediately
  // and loading whatever URL window.open() was called with (as the first test above does) means
  // loading "about:blank" here — the page visibly goes blank, and since `deny` makes window.open()
  // return null, the site's later `popup.location.href = ...` assignment throws and the flow just
  // stops. This is exactly what "clicking Sign in with Microsoft does nothing, page goes blank"
  // looked like in practice.
  test("a popup opened blank, with its URL assigned a moment later, still ends up loading in the webview", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window = await app.firstWindow();
    const consoleErrors: string[] = [];
    window.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    window.on("pageerror", (err) => consoleErrors.push(String(err)));

    await window.waitForSelector("text=Smart Locator Capture Studio");
    await createSession(window, "Deferred Popup Redirect Fixture", OPENER_URL);

    const windowCountBefore = app.windows().length;

    await window.evaluate(async () => {
      const webview = document.querySelector("webview") as unknown as {
        executeJavaScript: (code: string) => Promise<unknown>;
      };
      await webview.executeJavaScript(`
        (function () {
          var btn = document.querySelector("#openDeferredPopup");
          btn.click();
        })();
      `);
    });

    await window.waitForFunction(
      (expectedUrl) => {
        const wv = document.querySelector("webview") as unknown as { getURL?: () => string } | null;
        return !!wv?.getURL && wv.getURL() === expectedUrl;
      },
      TARGET_URL,
      { timeout: 15000 },
    );

    expect(app.windows()).toHaveLength(windowCountBefore);

    expect(consoleErrors, `Console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
    await app.close();
  });
});
