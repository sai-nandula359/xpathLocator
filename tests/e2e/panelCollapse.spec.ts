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

test.describe("side panels — collapse/expand", () => {
  test("collapsing a panel hides its body, keeps its header, and frees its space to the other panels", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window = await app.firstWindow();
    const consoleErrors: string[] = [];
    window.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    window.on("pageerror", (err) => consoleErrors.push(String(err)));

    await window.waitForSelector("text=Smart Locator Capture Studio");
    await createSession(window, "Panel Collapse Fixture", FIXTURE_URL);
    await ctrlClickInGuest(window, "#username");
    await window.waitForSelector("text=Captured Elements (1)");

    const domInspectorToggle = window.getByTestId("dom-inspector-collapse-toggle");
    const capturedToggle = window.getByTestId("captured-elements-collapse-toggle");
    const searchBox = window.locator('[data-role="element-search"]');

    await expect(searchBox).toBeVisible();
    const domInspectorBoxBefore = await domInspectorToggle.locator("..").locator("..").boundingBox();
    expect(domInspectorBoxBefore).not.toBeNull();

    // Collapse Captured Elements — its own search/filter UI must disappear, the header (with the
    // live count) must stay.
    await capturedToggle.click();
    await expect(searchBox).not.toBeVisible();
    await expect(window.getByText("Captured Elements (1)")).toBeVisible();

    // The freed space must go to the still-expanded panels, not sit empty — DOM Inspector (a
    // sibling in the same flex column) should have grown taller as a result.
    const domInspectorBoxAfter = await domInspectorToggle.locator("..").locator("..").boundingBox();
    expect(domInspectorBoxAfter).not.toBeNull();
    expect(domInspectorBoxAfter!.height).toBeGreaterThan(domInspectorBoxBefore!.height);

    // Expanding again brings the search/filter UI back.
    await capturedToggle.click();
    await expect(searchBox).toBeVisible();

    // Collapsing DOM Inspector's own placeholder ("no element to inspect yet") state works too —
    // exercised separately from Captured Elements to confirm the early-return branch (no
    // selected element) still renders a working collapse toggle, not just the populated one.
    await domInspectorToggle.click();
    await expect(window.getByText("Outer HTML")).not.toBeVisible();
    await expect(window.getByText("DOM Inspector")).toBeVisible();
    await domInspectorToggle.click();
    await expect(window.getByText("Outer HTML")).toBeVisible();

    expect(consoleErrors, `Console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
    await app.close();
  });

  test("Locator Details collapse works both with and without a selected element", async () => {
    const app = await electron.launch({ args: [path.join(__dirname, "..", "..")] });
    const window = await app.firstWindow();

    await window.waitForSelector("text=Smart Locator Capture Studio");
    // Deliberately avoids "Locator Details" as a substring — the session-switcher button's own
    // label embeds the session name, which would otherwise collide with the panel heading text.
    await createSession(window, "Bulk Checkbox Fixture Three", FIXTURE_URL);

    const locatorToggle = window.getByTestId("locator-details-collapse-toggle");

    // No element captured yet — the placeholder branch.
    await expect(window.getByText("Select a captured element to see its locators.")).toBeVisible();
    await locatorToggle.click();
    await expect(window.getByText("Select a captured element to see its locators.")).not.toBeVisible();
    await expect(window.getByText("Locator Details", { exact: true })).toBeVisible();
    await locatorToggle.click();
    await expect(window.getByText("Select a captured element to see its locators.")).toBeVisible();

    // Now with a real captured element — the populated branch.
    await ctrlClickInGuest(window, "#username");
    await window.waitForSelector("text=Captured Elements (1)");
    await expect(window.getByText("Locator Candidates")).toBeVisible();
    await locatorToggle.click();
    await expect(window.getByText("Locator Candidates", { exact: false })).not.toBeVisible();
    await locatorToggle.click();
    await expect(window.getByText("Locator Candidates", { exact: false })).toBeVisible();

    await app.close();
  });
});
