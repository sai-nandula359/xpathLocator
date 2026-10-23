/**
 * Electron main process. Creates the app window, disables the default menu (this reads as a
 * real desktop app rather than "a webpage in a frame"), and exposes IPC handlers the renderer
 * uses (via preload.cjs) for session persistence and file export/import.
 * There is no separate HTTP server — everything the doc's "suggested" FastAPI backend would have
 * done lives here in the main process instead, reached over IPC.
 */

const path = require("node:path");
const fs = require("node:fs/promises");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, Menu, ipcMain, dialog, webContents, session } = require("electron");
const ExcelJS = require("exceljs");

Menu.setApplicationMenu(null);

const isDev = process.env.ELECTRON_DEV === "1";

function resolveAppRoot() {
  // Dev: this file is <root>/electron/main.cjs. Packaged: <resources>/app/electron/main.cjs,
  // with dist/ copied alongside electron/ — either way, one level up contains dist/.
  return path.join(__dirname, "..");
}

function userDataDir() {
  return app.getPath("userData");
}

function sessionsDir() {
  return path.join(userDataDir(), "sessions");
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

// preload.cjs runs sandboxed, where `require` can't resolve `path`/`node:path` at all — so it
// asks for this synchronously instead of computing it itself.
ipcMain.on("get-webview-preload-path", (event) => {
  event.returnValue = pathToFileURL(path.join(__dirname, "webview-preload.cjs")).href;
});

// --- Session persistence -----------------------------------------------------------------

ipcMain.handle("sessions:list", async () => {
  await ensureDir(sessionsDir());
  const files = await fs.readdir(sessionsDir());
  const sessions = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(sessionsDir(), file), "utf-8");
      const parsed = JSON.parse(raw);
      sessions.push({
        id: parsed.id,
        name: parsed.name,
        createdAt: parsed.createdAt,
        updatedAt: parsed.updatedAt,
        baseUrl: parsed.baseUrl,
        elementCount: Array.isArray(parsed.elements) ? parsed.elements.length : 0,
      });
    } catch {
      // Skip unreadable/corrupt session files rather than failing the whole list.
    }
  }
  sessions.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  return sessions;
});

ipcMain.handle("sessions:load", async (_event, id) => {
  const filePath = path.join(sessionsDir(), `${id}.json`);
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
});

ipcMain.handle("sessions:save", async (_event, session) => {
  await ensureDir(sessionsDir());
  const filePath = path.join(sessionsDir(), `${session.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(session, null, 2), "utf-8");
  return { ok: true };
});

ipcMain.handle("sessions:delete", async (_event, id) => {
  const filePath = path.join(sessionsDir(), `${id}.json`);
  await fs.rm(filePath, { force: true });
  return { ok: true };
});

// --- Export / Import (native file dialogs, for interop with the outside world) -----------

ipcMain.handle("export:saveFile", async (_event, { defaultName, filters, content }) => {
  const win = BrowserWindow.getFocusedWindow();
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: defaultName,
    filters,
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  await fs.writeFile(filePath, content, "utf-8");
  return { ok: true, filePath };
});

// section 46 — Excel Export. Unlike the other export formats (plain text, written via
// export:saveFile), an xlsx file is a binary zip archive — building it needs a real library
// (ExcelJS) and Node's fs, neither of which the sandboxed renderer has access to, so the
// renderer only ever sends plain sheet data over here rather than a finished file's content.
ipcMain.handle("export:saveExcel", async (_event, { defaultName, sheets }) => {
  const win = BrowserWindow.getFocusedWindow();
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: defaultName,
    filters: [{ name: "Excel Workbook", extensions: ["xlsx"] }],
  });
  if (canceled || !filePath) return { ok: false, canceled: true };

  const workbook = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name);
    ws.addRow(sheet.columns);
    ws.getRow(1).font = { bold: true };
    for (const row of sheet.rows) ws.addRow(row);
    ws.columns.forEach((col, i) => {
      const header = String(sheet.columns[i] ?? "");
      const longest = sheet.rows.reduce((max, row) => Math.max(max, String(row[i] ?? "").length), header.length);
      col.width = Math.min(Math.max(longest + 2, 10), 60);
    });
  }
  await workbook.xlsx.writeFile(filePath);
  return { ok: true, filePath };
});

ipcMain.handle("import:openFile", async (_event, { filters }) => {
  const win = BrowserWindow.getFocusedWindow();
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    filters,
    properties: ["openFile"],
  });
  if (canceled || filePaths.length === 0) return { ok: false, canceled: true };
  const content = await fs.readFile(filePaths[0], "utf-8");
  return { ok: true, filePath: filePaths[0], content };
});

// section 64 — Session Import. .xlsx is a binary zip archive, same reason export:saveExcel above
// builds workbooks here rather than in the sandboxed renderer — reading it as UTF-8 text (like
// the plain-text branch above) would corrupt it, so this reads the raw bytes and hands ExcelJS
// the buffer directly, returning the "Elements" sheet's own rows (header included) rather than a
// finished CaptureSession — src/import/excel.ts owns turning those rows back into one.
ipcMain.handle("import:openSessionFile", async (_event, { filters }) => {
  const win = BrowserWindow.getFocusedWindow();
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    filters,
    properties: ["openFile"],
  });
  if (canceled || filePaths.length === 0) return { ok: false, canceled: true };

  const filePath = filePaths[0];
  if (!filePath.toLowerCase().endsWith(".xlsx")) {
    const content = await fs.readFile(filePath, "utf-8");
    return { ok: true, filePath, format: "text", content };
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.getWorksheet("Elements") ?? workbook.worksheets[0];
  if (!worksheet) return { ok: false, canceled: false, error: "Workbook has no sheets." };

  const rows = [];
  worksheet.eachRow((row) => {
    // ExcelJS's row.values is 1-indexed with a leading empty slot — slice it off, and stringify
    // every cell so the renderer gets the same plain (string | number) shape export:saveExcel
    // sends the other way.
    const values = row.values.slice(1).map((v) => (v == null ? "" : v));
    rows.push(values);
  });
  return { ok: true, filePath, format: "excel", rows };
});

// --- Responsive device emulation ----------------------------------------------------------
// enableDeviceEmulation()/disableDeviceEmulation() only exist on webContents, not on the
// <webview> tag itself — the renderer sends over the guest's webContents id (from the tag's own
// getWebContentsId()) so it can be resolved here.

ipcMain.handle("device:enable-emulation", (_event, { webContentsId, parameters }) => {
  const wc = webContents.fromId(webContentsId);
  if (!wc) return { ok: false };
  wc.enableDeviceEmulation(parameters);
  return { ok: true };
});

ipcMain.handle("device:disable-emulation", (_event, { webContentsId }) => {
  const wc = webContents.fromId(webContentsId);
  if (!wc) return { ok: false };
  wc.disableDeviceEmulation();
  return { ok: true };
});

// --- Window -------------------------------------------------------------------------------

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: "Smart Locator Capture Studio",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true,
    },
  });

  // Runs webview-preload.cjs in every frame of the guest page, not just the top one. Same-origin
  // iframes were already capturable from the top frame's script (via contentDocument), but a
  // cross-origin one — a Microsoft/Google sign-in frame, a payment widget, an embedded app — is
  // off-limits to it by the same-origin policy. With its own copy of the script running inside,
  // that frame handles its own capture. Despite the name this grants no Node.js access: the guest
  // stays sandboxed with nodeIntegration off; it only controls where the preload runs.
  win.webContents.on("will-attach-webview", (_event, webPreferences) => {
    webPreferences.nodeIntegrationInSubFrames = true;
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    // Not auto-opening DevTools here: a *detached* DevTools window reliably steals OS-level
    // keyboard focus from the main window right after launch, on Windows in particular — every
    // keystroke goes to DevTools instead of whatever's focused in the app (a modal's input
    // field, the address bar, ...), which looks exactly like "the app doesn't accept typing"
    // and is invisible to CDP-driven automation (which bypasses real OS focus entirely, so it
    // never reproduces this). Open DevTools manually with Ctrl+Shift+I / F12 when needed.
  } else {
    win.loadFile(path.join(resolveAppRoot(), "dist", "index.html"));
  }

  return win;
}

// Every "Copy" button in the app (locator values, generated code, Page Objects) only ever
// *writes* to the clipboard, which Chromium allows without a permission grant when triggered
// from a real click. Explicitly granting clipboard-read/clipboard-sanitized-write too — rather
// than leaving Chromium's default (which denies an ungranted read, so
// navigator.clipboard.readText() silently resolves to "") — is what actually lets the app (and
// the e2e suite, which verifies a copy button's own output by reading the clipboard back) trust
// its own clipboard round-trip.
function registerClipboardPermissions() {
  const isClipboardPermission = (permission) => permission === "clipboard-read" || permission === "clipboard-sanitized-write";
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(isClipboardPermission(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => isClipboardPermission(permission));
}

// Many login/SSO flows (Microsoft/MSAL, Google, ...) open their sign-in step as a popup
// (window.open()/target="_blank") and depend on the *opener* page staying alive while it's open:
// MSAL's popup flow keeps polling `popup.location` from the original page and only completes —
// reading the auth response and closing the popup itself — once the popup lands back on the
// app's redirect URI. Loading the popup's URL into the main webview instead (an earlier version
// of this) replaces that opener page, so nothing is left to finish the handshake and the login
// never completes. Popups therefore open as real child windows — parented to the app window,
// sharing the webview's partition (cookies/session) and running webview-preload.cjs, so Ctrl+Click
// capture works inside them too, with captures relayed back to the app via the popup:* channels
// below — while the original page in the webview stays exactly where it was.
const WEBVIEW_PARTITION = "persist:capture-session"; // must match BrowserWorkspace.tsx's <webview>


// Last value the renderer pushed via capture-mode:set. webview-preload.cjs reads it on startup
// (guest:get-capture-mode) in every frame and popup it runs in — the renderer's own
// webview.send() only ever reaches the webview's top frame, never a subframe or a popup.
let captureMode = true;

function appWindowFor(contents) {
  // A webview guest's host is the app window's own webContents; a popup's (any depth) is its
  // parent window, which openPopupsAsChildWindows() always sets to that same app window.
  const host = contents.hostWebContents ?? BrowserWindow.fromWebContents(contents)?.getParentWindow()?.webContents;
  return host ? BrowserWindow.fromWebContents(host) : null;
}

function handlePopupsFrom(contents) {
  contents.setWindowOpenHandler(() => {
    const parent = appWindowFor(contents);
    return {
      action: "allow",
      overrideBrowserWindowOptions: {
        parent: parent ?? undefined,
        autoHideMenuBar: true,
        webPreferences: {
          preload: path.join(__dirname, "webview-preload.cjs"),
          partition: WEBVIEW_PARTITION,
          contextIsolation: true,
          nodeIntegration: false,
          nodeIntegrationInSubFrames: true, // see the will-attach-webview comment in createWindow()
          sandbox: true,
        },
      },
    };
  });

  // A popup opening its own popup (a "pick an account" step, say) gets the same treatment.
  contents.on("did-create-window", (childWindow) => handlePopupsFrom(childWindow.webContents));
}

function openPopupsAsChildWindows() {
  app.on("web-contents-created", (_event, contents) => {
    if (contents.getType() === "webview") handlePopupsFrom(contents);
  });
}

// webview-preload.cjs can't use sendToHost() inside a popup — there's no <webview> host there —
// so it asks once which kind of page it's running in. The app window's own page never loads that
// preload, so any "window"-type sender here is a popup.
ipcMain.on("guest:is-popup-window", (event) => {
  event.returnValue = event.sender.getType() === "window";
});

ipcMain.on("popup:message", (event, channel, payload) => {
  const appWindow = appWindowFor(event.sender);
  if (!appWindow || appWindow.isDestroyed()) return;
  appWindow.webContents.send("popup:message", { popupId: event.sender.id, channel, payload });
});

ipcMain.on("guest:get-capture-mode", (event) => {
  event.returnValue = captureMode;
});

ipcMain.handle("capture-mode:set", (_event, enabled) => {
  captureMode = enabled;
  for (const wc of webContents.getAllWebContents()) {
    const isGuest = wc.getType() === "webview" || !!BrowserWindow.fromWebContents(wc)?.getParentWindow();
    if (!isGuest || wc.isDestroyed()) continue;
    for (const frame of wc.mainFrame.framesInSubtree) frame.send("set-capture-mode", enabled);
  }
});

// Live validation for an element captured inside a popup has to run against *that* popup's DOM,
// not the main webview's — the renderer can't reach a popup's webContents directly.
ipcMain.handle("popups:execute-javascript", async (_event, { popupId, code }) => {
  const wc = webContents.fromId(popupId);
  if (!wc || wc.isDestroyed()) throw new Error("The popup window has been closed.");
  return wc.executeJavaScript(code);
});

// Same idea for an element captured inside a cross-origin iframe: neither webview.executeJavaScript()
// nor a script running in the top document can reach into it (same-origin policy), but the main
// process can run a script directly in that frame. Frames are found by their current URL rather
// than a frame id, so re-validating after a reload (which recreates every frame) still works.
ipcMain.handle("frames:execute-javascript", async (_event, { webContentsId, frameUrl, code }) => {
  const wc = webContents.fromId(webContentsId);
  if (!wc || wc.isDestroyed()) throw new Error("The page this element was captured on has been closed.");
  const frame = wc.mainFrame.framesInSubtree.find((f) => f !== wc.mainFrame && f.url === frameUrl);
  if (!frame) throw new Error(`The frame this element was captured in (${frameUrl}) isn't on the current page.`);
  return frame.executeJavaScript(code);
});

app.whenReady().then(() => {
  registerClipboardPermissions();
  openPopupsAsChildWindows();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
