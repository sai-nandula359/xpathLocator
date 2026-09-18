import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { _electron as electron, expect, test } from "@playwright/test";
import { createSession } from "./helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_URL = pathToFileURL(path.join(__dirname, "..", "fixtures", "login.html")).href;

test.describe("webview error surfacing", () => {
  test("a real navigation failure (connection refused) shows a dismissible error banner", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window = await app.firstWindow();

    await window.waitForSelector("text=Smart Locator Capture Studio");
    await createSession(window, "Page Error Fixture", FIXTURE_URL);

    // Port 1 is one of Chromium's "unsafe ports" and is refused instantly with ERR_UNSAFE_PORT,
    // with no DNS/network I/O involved at all — deterministic regardless of outbound network
    // access (confirmed via a raw webview-level listener: fires in well under a second).
    const addressBar = window.getByPlaceholder("Enter a URL and press Enter…");
    await addressBar.fill("http://127.0.0.1:1/");
    await addressBar.press("Enter");

    const banner = window.getByTestId("page-error-banner");
    await expect(banner).toBeVisible({ timeout: 15000 });
    await expect(banner).toContainText("127.0.0.1:1");
    // Connection-refused is a load failure, not a crash/hang — no Reload action for this kind.
    await expect(banner.getByText("Reload")).toHaveCount(0);

    await banner.getByRole("button").click();
    await expect(banner).not.toBeVisible();

    await app.close();
  });

  test("a normal, successful navigation does not show an error banner", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window = await app.firstWindow();

    await window.waitForSelector("text=Smart Locator Capture Studio");
    await createSession(window, "Page Error Control Fixture", FIXTURE_URL);

    await expect(window.getByTestId("page-error-banner")).toHaveCount(0);

    await app.close();
  });
});
