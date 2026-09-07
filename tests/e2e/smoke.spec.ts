import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron, expect, test } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("app launches, shows the chrome, and creates a capture session", async () => {
  const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
  const consoleErrors: string[] = [];

  const window = await app.firstWindow();
  window.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  window.on("pageerror", (err) => consoleErrors.push(String(err)));

  await window.waitForSelector("text=Smart Locator Capture Studio", { timeout: 15000 });
  await expect(window.getByText("Ctrl+Click an element")).toBeVisible();

  await window.screenshot({ path: path.join(__dirname, "..", "..", "tests", "e2e", "smoke-screenshot.png") });

  expect(consoleErrors, `Console errors:\n${consoleErrors.join("\n")}`).toEqual([]);

  await app.close();
});
