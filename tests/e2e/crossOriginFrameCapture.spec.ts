import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron, expect, test, type ElectronApplication, type Frame, type Page } from "@playwright/test";
import { createSession } from "./helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

// One server, reached under two hostnames: 127.0.0.1 and localhost are different origins to the
// browser, so the host page and its iframe are genuinely cross-origin — file:// fixtures (which
// every other frame test uses) are treated as same-origin and can't exercise this.
function startFixtureServer(): Promise<Server> {
  const server = createServer((req, res) => {
    const name = path.basename(new URL(req.url ?? "/", "http://x").pathname);
    readFile(path.join(FIXTURES_DIR, name))
      .then((body) => {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(body);
      })
      .catch(() => {
        res.writeHead(404);
        res.end();
      });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

// app.windows() includes the <webview> guest's own page, whose frames include the iframe.
async function guestFrame(app: ElectronApplication, frameUrl: string): Promise<Frame> {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const frame = app
      .windows()
      .flatMap((page) => page.frames())
      .find((f) => f.url() === frameUrl);
    if (frame) return frame;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`frame never loaded: ${frameUrl}`);
}

async function ctrlClick(frame: Frame, selector: string) {
  await frame.evaluate((sel) => {
    const el = document.querySelector(sel)!;
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
  }, selector);
}

// Regression guard for "N cross-origin iframe(s) on this page can't be inspected": an embedded
// sign-in/payment/app frame from another origin used to be uncapturable, since the page-level
// capture script is locked out of it by the same-origin policy. The capture script now runs inside
// every frame itself, and live validation runs directly in the frame the element came from.
test.describe("capture inside a cross-origin iframe", () => {
  let server: Server;
  let port: number;

  test.beforeAll(async () => {
    server = await startFixtureServer();
    port = (server.address() as AddressInfo).port;
  });

  test.afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  test("captures an element inside the frame with locators validated against the frame's own document", async () => {
    const hostUrl = `http://127.0.0.1:${port}/cross-origin-host.html?frameOrigin=${encodeURIComponent(`http://localhost:${port}`)}`;
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window: Page = await app.firstWindow();
    const consoleErrors: string[] = [];
    window.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    window.on("pageerror", (err) => consoleErrors.push(String(err)));

    await window.waitForSelector("text=Smart Locator Capture Studio");
    await createSession(window, "Cross-Origin Frame Fixture", hostUrl);
    const frame = await guestFrame(app, `http://localhost:${port}/cross-origin-frame.html`);
    await frame.waitForSelector("#crossFrameButton");

    await ctrlClick(frame, "#crossFrameButton");
    await window.waitForSelector("text=Captured Elements (1)", { timeout: 15000 });

    // Every candidate validated inside the frame — against the top document, #crossFrameButton
    // doesn't exist at all and everything would read "0 matches".
    await expect(window.locator("code", { hasText: "cross-frame-button" }).first()).toBeVisible();
    await expect(window.getByText(/1 match.*Unique/).first()).toBeVisible();
    await expect(window.getByText("0 matches")).not.toBeVisible();
    await expect(window.getByText(/can't be inspected/)).not.toBeVisible();

    // Capture mode reaches the frame too: with it off, a Ctrl+Click there captures nothing.
    await window.locator('button[title="Toggle capture mode (Ctrl+Shift+C)"]').click();
    await expect(window.getByText("Capture Mode Off")).toBeVisible();
    await ctrlClick(frame, "#crossFrameButton");
    await window.waitForTimeout(1000);
    await expect(window.getByText("Captured Elements (1)")).toBeVisible();

    expect(consoleErrors, `Console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
    await app.close();
  });
});
