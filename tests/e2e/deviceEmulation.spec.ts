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

async function webviewBox(window: Page): Promise<{ width: number; height: number } | null> {
  return window.evaluate(() => {
    const el = document.querySelector("webview");
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { width: Math.round(rect.width), height: Math.round(rect.height) };
  });
}

test.describe("Responsive device emulation", () => {
  test("selecting a device frames the webview to its resolution, and capture still works inside it", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window = await app.firstWindow();
    const consoleErrors: string[] = [];
    window.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    window.on("pageerror", (err) => consoleErrors.push(String(err)));

    await window.waitForSelector("text=Smart Locator Capture Studio");
    await createSession(window, "Device Emulation Fixture", FIXTURE_URL);

    // Desktop by default — the webview fills the whole workspace, well over any phone width.
    const desktopBox = await webviewBox(window);
    expect(desktopBox!.width).toBeGreaterThan(500);

    await window.getByTestId("device-select").selectOption("iphone-se");
    await window.waitForTimeout(500); // emulation is applied via an async IPC round-trip

    const phoneBox = await webviewBox(window);
    expect(phoneBox!.width).toBe(375);
    expect(phoneBox!.height).toBe(667);

    // Ctrl+Click capture still works at this resolution — no capture-path changes needed for it.
    await ctrlClickInGuest(window, "#loginButton");
    await window.waitForSelector("text=Captured Elements (1)");

    // The captured element's snapshot records the emulated viewport.
    await expect(window.getByTestId("dom-inspector-viewport")).toHaveText("375×667");

    // Switching back to Desktop restores the webview to filling the workspace.
    await window.getByTestId("device-select").selectOption("desktop");
    await window.waitForTimeout(500);
    const backToDesktopBox = await webviewBox(window);
    expect(backToDesktopBox!.width).toBeGreaterThan(500);

    // setUserAgent() makes Chromium reload the affected page — same class of benign-but-noisy
    // ERR_ABORTED BrowserWorkspace.tsx's own session-switch loadURL logic already documents,
    // here from a UA change landing while a very recent prior navigation was still settling.
    const unexpectedErrors = consoleErrors.filter((e) => !e.includes("ERR_ABORTED"));
    expect(unexpectedErrors, `Console errors:\n${unexpectedErrors.join("\n")}`).toEqual([]);
    await app.close();
  });

  test("Responsive (Custom) frames the webview to a user-typed width/height, and Rotate swaps them", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window = await app.firstWindow();
    await window.waitForSelector("text=Smart Locator Capture Studio");
    await createSession(window, "Device Emulation Custom Fixture", FIXTURE_URL);

    await window.getByTestId("device-select").selectOption("responsive");
    await window.getByTestId("device-custom-width").fill("600");
    await window.getByTestId("device-custom-height").fill("400");
    await window.waitForTimeout(500);

    const box = await webviewBox(window);
    expect(box).toEqual({ width: 600, height: 400 });

    await window.getByTestId("device-rotate").click();
    await window.waitForTimeout(300);
    // Rotating a Responsive/custom size just swaps the two dimensions it already has.
    const rotatedBox = await webviewBox(window);
    expect(rotatedBox).toEqual({ width: 400, height: 600 });

    await app.close();
  });
});
