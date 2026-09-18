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

test.describe("captured elements — bulk operations and sort", () => {
  test("bulk rename numbers the selected elements with a shared prefix", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window = await app.firstWindow();

    await window.waitForSelector("text=Smart Locator Capture Studio");
    await createSession(window, "Bulk Rename Fixture", FIXTURE_URL);

    await ctrlClickInGuest(window, "#username");
    await window.waitForSelector("text=Captured Elements (1)");
    await ctrlClickInGuest(window, "#loginButton");
    await window.waitForSelector("text=Captured Elements (2)");

    await window.getByTestId("select-all-checkbox").check();
    await window.getByTitle("Rename selected").click();
    const dialog = window.getByRole("dialog", { name: "Bulk Rename" });
    await expect(dialog).toBeVisible();
    await window.getByPlaceholder("e.g. NavLink").fill("Field");
    await dialog.getByRole("button", { name: "Rename", exact: true }).click();

    const rows = window.locator('[data-testid="captured-element-row"]');
    await expect(rows.filter({ hasText: "Field_1" })).toBeVisible();
    await expect(rows.filter({ hasText: "Field_2" })).toBeVisible();

    await app.close();
  });

  test("bulk set-primary switches every selected element's primary locator to a CSS candidate", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window = await app.firstWindow();

    await window.waitForSelector("text=Smart Locator Capture Studio");
    await createSession(window, "Bulk Primary Fixture", FIXTURE_URL);

    await ctrlClickInGuest(window, "#username");
    await window.waitForSelector("text=Captured Elements (1)");
    await ctrlClickInGuest(window, "#loginButton");
    await window.waitForSelector("text=Captured Elements (2)");

    await window.getByTestId("select-all-checkbox").check();
    await window.getByTitle("Set primary locator to the best CSS candidate for each selected element").click();

    // Both #username and #loginButton have an id, so a CSS candidate is always generated for
    // them — rather than pin the exact toast wording (it also has a "some skipped" variant),
    // just poll for the real postcondition below.
    const rows = window.locator('[data-testid="captured-element-row"]');
    await expect(rows).toHaveCount(2);
    // A CSS primary never starts with "//" (XPath's own syntax) — a coarse but reliable check
    // that both rows now show a CSS-shaped locator without depending on the exact string.
    await expect
      .poll(async () => {
        const codes = await rows.locator("code").allInnerTexts();
        return codes.every((c) => !c.startsWith("//"));
      })
      .toBe(true);

    await app.close();
  });

  test("bulk copy writes a name: locator line per selected element to the clipboard", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window = await app.firstWindow();

    await window.waitForSelector("text=Smart Locator Capture Studio");
    await createSession(window, "Bulk Copy Fixture", FIXTURE_URL);

    await ctrlClickInGuest(window, "#username");
    await window.waitForSelector("text=Captured Elements (1)");

    await window.getByTestId("select-all-checkbox").check();
    await window.getByTitle("Copy selected elements' primary locators").click();
    await window.waitForSelector("text=Copied 1 locator");

    const clipboardText = await window.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain("Username Input:");

    await app.close();
  });

  test("sorting by Name reorders the captured elements list alphabetically", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window = await app.firstWindow();

    await window.waitForSelector("text=Smart Locator Capture Studio");
    // Deliberately avoids the word "Sort" — the header's session-switcher button title embeds
    // the session name ("Current session: ..."), which would otherwise collide with a getByTitle
    // lookup for the Sort control itself (see selectAll.spec.ts's own note on this).
    await createSession(window, "Ordering Fixture", FIXTURE_URL);

    // Capture in an order whose names are NOT already alphabetical: Username Input first (append
    // order puts it on top under "Capture Order"), then Login Submit Button — "Login..." sorts
    // before "Username..." alphabetically, so switching to Name sort must reorder the rows.
    await ctrlClickInGuest(window, "#username");
    await window.waitForSelector("text=Captured Elements (1)");
    await ctrlClickInGuest(window, "#loginButton");
    await window.waitForSelector("text=Captured Elements (2)");

    const rowNames = () => window.locator('[data-testid="captured-element-row"] span.font-semibold').allInnerTexts();
    await expect.poll(rowNames).toEqual(["Username Input", "Login Submit Button"]);

    await window.getByTestId("sort-select").selectOption("name");
    await expect.poll(rowNames).toEqual(["Login Submit Button", "Username Input"]);

    await app.close();
  });
});
