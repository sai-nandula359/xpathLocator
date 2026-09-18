export {};

declare global {
  interface SessionSummary {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    baseUrl: string;
    elementCount: number;
  }

  interface FileDialogFilter {
    name: string;
    extensions: string[];
  }

  interface SaveFileResult {
    ok: boolean;
    canceled?: boolean;
    filePath?: string;
  }

  interface OpenFileResult {
    ok: boolean;
    canceled?: boolean;
    filePath?: string;
    content?: string;
  }

  interface OpenSessionFileResult {
    ok: boolean;
    canceled?: boolean;
    error?: string;
    filePath?: string;
    format?: "text" | "excel";
    /** Present when format is "text" (a .json or .csv file read as UTF-8). */
    content?: string;
    /** Present when format is "excel" — the "Elements" worksheet's own rows, header included. */
    rows?: (string | number)[][];
  }

  interface ExcelSheet {
    name: string;
    columns: string[];
    rows: (string | number)[][];
  }

  interface DeviceEmulationParameters {
    screenPosition: "desktop" | "mobile";
    screenSize: { width: number; height: number };
    viewPosition: { x: number; y: number };
    deviceScaleFactor: number;
    viewSize: { width: number; height: number };
    scale?: number;
  }

  interface CaptureStudioBridge {
    webviewPreloadPath: string;
    sessions: {
      list: () => Promise<SessionSummary[]>;
      load: (id: string) => Promise<unknown>;
      save: (session: unknown) => Promise<{ ok: boolean }>;
      delete: (id: string) => Promise<{ ok: boolean }>;
    };
    files: {
      saveFile: (args: {
        defaultName: string;
        filters: FileDialogFilter[];
        content: string;
      }) => Promise<SaveFileResult>;
      saveExcel: (args: { defaultName: string; sheets: ExcelSheet[] }) => Promise<SaveFileResult>;
      openFile: (args: { filters: FileDialogFilter[] }) => Promise<OpenFileResult>;
      openSessionFile: (args: { filters: FileDialogFilter[] }) => Promise<OpenSessionFileResult>;
    };
    device: {
      enableEmulation: (webContentsId: number, parameters: DeviceEmulationParameters) => Promise<{ ok: boolean }>;
      disableEmulation: (webContentsId: number) => Promise<{ ok: boolean }>;
    };
  }

  interface Window {
    captureStudio: CaptureStudioBridge;
  }

  // @types/react already declares the <webview> JSX intrinsic and a matching (empty)
  // `HTMLWebViewElement` global interface — this fills that interface in with the actual
  // Electron instance API via declaration merging, rather than redeclaring the JSX intrinsic
  // (which would conflict with React's own attribute types, e.g. allowpopups: boolean).
  interface HTMLWebViewElement {
    executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>;
    loadURL(url: string): Promise<void>;
    send(channel: string, ...args: unknown[]): void;
    goBack(): void;
    goForward(): void;
    reload(): void;
    stop(): void;
    getURL(): string;
    getTitle(): string;
    canGoBack(): boolean;
    canGoForward(): boolean;
    isLoading(): boolean;
    getWebContentsId(): number;
    getUserAgent(): string;
    setUserAgent(userAgent: string): void;
  }

  // Alias used throughout the app's own code so it reads as "the Electron webview element"
  // rather than the DOM lib's oddly-cased native name.
  type ElectronWebviewElement = HTMLWebViewElement;
}
