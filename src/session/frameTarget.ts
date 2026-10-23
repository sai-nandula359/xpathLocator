// Picks where an element's live-validation scripts should run. Ordinarily that's the page itself
// (the main webview, or a popup) — but an element captured inside a cross-origin iframe lives in a
// document no script on that page can reach, so its scripts are sent through the main process to
// run inside that exact frame instead (see "frames:execute-javascript" in electron/main.cjs).

import type { ElementSnapshot } from "@/types";

export function frameAwareTarget(
  pageTarget: ScriptTarget,
  webContentsId: number,
  snapshot: Pick<ElementSnapshot, "frameUrl">,
): ScriptTarget {
  const { frameUrl } = snapshot;
  if (!frameUrl) return pageTarget;
  return {
    executeJavaScript: (code) => window.captureStudio.frames.executeJavaScript(webContentsId, frameUrl, code),
  };
}

/** The usual case: an element being (re-)validated against the main webview. */
export function webviewTargetFor(webview: ElectronWebviewElement, snapshot: Pick<ElementSnapshot, "frameUrl">): ScriptTarget {
  return snapshot.frameUrl ? frameAwareTarget(webview, webview.getWebContentsId(), snapshot) : webview;
}
