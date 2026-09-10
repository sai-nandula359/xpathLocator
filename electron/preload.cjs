/**
 * Preload script for the main BrowserWindow. Runs with contextIsolation+sandbox, so it can only
 * reach the main process through ipcRenderer — exposed to the renderer as window.captureStudio.
 */

const { contextBridge, ipcRenderer } = require("electron");

// The <webview> tag's `preload` attribute needs an absolute file:// URL — a relative path
// resolves against the *renderer's* URL (an http://localhost Vite dev URL, or a packaged
// file:// page), not this script's own location. Sandboxed preload's polyfilled `require`
// only resolves a small allow-list of built-ins (electron, events, timers, url) and neither
// `path` nor `node:`-prefixed specifiers are in it, so the actual path is computed in the
// (unsandboxed) main process instead and fetched synchronously here.
const webviewPreloadPath = ipcRenderer.sendSync("get-webview-preload-path");

contextBridge.exposeInMainWorld("captureStudio", {
  webviewPreloadPath,
  sessions: {
    list: () => ipcRenderer.invoke("sessions:list"),
    load: (id) => ipcRenderer.invoke("sessions:load", id),
    save: (session) => ipcRenderer.invoke("sessions:save", session),
    delete: (id) => ipcRenderer.invoke("sessions:delete", id),
  },
  files: {
    saveFile: (args) => ipcRenderer.invoke("export:saveFile", args),
    openFile: (args) => ipcRenderer.invoke("import:openFile", args),
  },
  device: {
    enableEmulation: (webContentsId, parameters) =>
      ipcRenderer.invoke("device:enable-emulation", { webContentsId, parameters }),
    disableEmulation: (webContentsId) => ipcRenderer.invoke("device:disable-emulation", { webContentsId }),
  },
});
