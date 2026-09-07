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
      openFile: (args: { filters: FileDialogFilter[] }) => Promise<OpenFileResult>;
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
  }

  // Alias used throughout the app's own code so it reads as "the Electron webview element"
  // rather than the DOM lib's oddly-cased native name.
  type ElectronWebviewElement = HTMLWebViewElement;
}
