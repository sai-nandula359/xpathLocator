import type { Page } from "@playwright/test";

/** Opens the header's session dropdown, clicks its "New Session" entry, fills in the modal, and
 * waits for the webview to actually navigate to `url`. "New Session" only exists inside that
 * dropdown panel (it's not a standalone always-visible button) — the panel has to be opened
 * first via the trigger, which always shows whichever session is currently active. */
export async function createSession(window: Page, name: string, url: string, timeout = 15000): Promise<void> {
  await window.locator('button[title^="Current session"]').click();
  await window.getByRole("button", { name: "New Session" }).click();
  await window.getByLabel("Session Name").fill(name);
  await window.getByLabel("Starting URL").fill(url);
  await window.getByRole("button", { name: "Create" }).click();
  await window.waitForFunction(
    (expectedUrl) => {
      const wv = document.querySelector("webview") as unknown as { getURL?: () => string } | null;
      return !!wv?.getURL && wv.getURL() === expectedUrl;
    },
    url,
    { timeout },
  );
}
