import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { _electron as electron, expect, test, type Page } from "@playwright/test";
import { createSession } from "./helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_URL = pathToFileURL(path.join(__dirname, "..", "fixtures", "login.html")).href;

// Reaches directly into the same-origin <iframe>'s own document to dispatch the click — the
// same thing a real Ctrl+Click on an element visually inside the frame does.
async function ctrlClickInGuestFrame(window: Page, frameSelector: string, elementSelector: string) {
  await window.evaluate(
    async ({ frameSelector, elementSelector }) => {
      const webview = document.querySelector("webview") as unknown as {
        executeJavaScript: (code: string) => Promise<unknown>;
      };
      await webview.executeJavaScript(`
        (function () {
          var frame = document.querySelector(${JSON.stringify(frameSelector)});
          var innerDoc = frame && frame.contentDocument;
          var el = innerDoc && innerDoc.querySelector(${JSON.stringify(elementSelector)});
          if (!el) throw new Error("frame element not found: " + ${JSON.stringify(elementSelector)});
          var rect = el.getBoundingClientRect();
          var evt = new MouseEvent("click", {
            bubbles: true, cancelable: true, ctrlKey: true,
            clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
          });
          el.dispatchEvent(evt);
        })();
      `);
    },
    { frameSelector, elementSelector },
  );
}

test.describe("capture inside a same-origin iframe", () => {
  test("captures an element inside a frame, and its locators validate as genuinely unique against the frame's own document", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window = await app.firstWindow();
    const consoleErrors: string[] = [];
    window.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    window.on("pageerror", (err) => consoleErrors.push(String(err)));

    await window.waitForSelector("text=Smart Locator Capture Studio");
    await createSession(window, "Bulk Checkbox Fixture Four", FIXTURE_URL);
    // Give the iframe a moment to finish its own navigation — this is exactly the race the fix
    // addresses (webview-preload.cjs's setupFrame retries on the frame's own 'load' event), but
    // the real-world timing this locks in is "click sometime after the page looks loaded," not
    // "click in the exact instant DOMContentLoaded fires."
    await window.waitForTimeout(500);

    await ctrlClickInGuestFrame(window, "#sameOriginFrame", "#frameButton");
    await window.waitForSelector("text=Captured Elements (1)", { timeout: 15000 });

    // Records which frame it came from, human-readably, in the page-url line.
    await expect(window.getByText(/frame: \.\/login-frame\.html/)).toBeVisible();

    // The core regression this guards: every candidate must validate against the *frame's own*
    // document, not the outer page (which would report 0 matches for everything, since
    // #frameButton doesn't exist in the top document at all).
    const primaryBadge = window.locator("code", { hasText: "frame-button" }).first();
    await expect(primaryBadge).toBeVisible();
    await expect(window.getByText(/1 match.*Unique/).first()).toBeVisible();
    await expect(window.getByText("0 matches")).not.toBeVisible();

    expect(consoleErrors, `Console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
    await app.close();
  });
});
