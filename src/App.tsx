import { AlertCircle, CheckCircle, Info, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import BrowserWorkspace from "@/components/BrowserWorkspace";
import CapturedElementsPanel from "@/components/CapturedElementsPanel";
import DomInspectorPanel from "@/components/DomInspectorPanel";
import DuplicatePromptModal from "@/components/DuplicatePromptModal";
import ExportDialog from "@/components/ExportDialog";
import Header from "@/components/Header";
import LocatorDetailsPanel from "@/components/LocatorDetailsPanel";
import NewSessionModal from "@/components/NewSessionModal";
import { useCaptureSession } from "@/hooks/useCaptureSession";
import type { WebviewCaptureApi } from "@/hooks/useWebviewCapture";
import { loadSession } from "@/session/sessionStore";

type ModalKind = "new-session" | "export" | null;

const DARK_MODE_KEY = "slcs-dark-mode";

function loadDarkMode(): boolean {
  try {
    const stored = window.localStorage.getItem(DARK_MODE_KEY);
    return stored === null ? true : stored === "1";
  } catch {
    return true;
  }
}

export default function App() {
  const api = useCaptureSession();
  const webviewRef = useRef<ElectronWebviewElement | null>(null);
  const [webviewApi, setWebviewApi] = useState<WebviewCaptureApi | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [isDarkMode, setIsDarkMode] = useState(loadDarkMode);

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [isDarkMode]);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(DARK_MODE_KEY, next ? "1" : "0");
      } catch {
        // Private/blocked storage — theme just won't persist across restarts.
      }
      return next;
    });
  }, []);

  const openSession = useCallback(
    async (id: string) => {
      try {
        // Flush whatever's currently loaded before switching away from it — the autosave effect
        // in useCaptureSession is debounced, so without this, edits made in the last moment
        // before switching sessions could be lost.
        if (api.hasActiveSession) await api.saveSession();
        const session = await loadSession(id);
        api.replaceSession(session);
        api.addToast(`Opened "${session.name}".`, "success");
      } catch {
        api.addToast("Failed to open that session.", "error");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api],
  );

  const startNewSession = useCallback(
    (name: string, baseUrl: string) => {
      if (api.hasActiveSession) void api.saveSession();
      api.startNewSession(name, baseUrl);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api],
  );

  // Global keyboard shortcuts (section 54) — these only see key events that reach the host
  // document; while focus is inside the <webview>'s own page, the guest's own preload script
  // (webview-preload.cjs) is what handles Ctrl+Shift+C / Esc for capture mode instead.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const inTextField = ["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName);
      if (e.ctrlKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void api.saveSession();
      } else if (e.ctrlKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('[data-role="element-search"]')?.focus();
      } else if (e.ctrlKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setModal("export");
      } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        webviewApi?.toggleCaptureMode();
      } else if (e.key === "Escape") {
        if (modal) setModal(null);
        else webviewApi?.setCaptureModeEnabled(false);
      } else if (e.key === "Delete" && !inTextField && api.selectedElementId) {
        api.deleteElements(new Set([api.selectedElementId]));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [api, webviewApi, modal]);

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-150 font-sans antialiased">
      <Header
        api={api}
        webviewApi={
          webviewApi ?? {
            captureModeEnabled: false,
            toggleCaptureMode: () => {},
            setCaptureModeEnabled: () => {},
            url: "",
            pageTitle: "",
            isLoading: false,
            canGoBack: false,
            canGoForward: false,
            duplicatePrompt: null,
            resolveDuplicate: () => {},
            frameNotice: null,
            dismissFrameNotice: () => {},
            navigateTo: () => {},
          }
        }
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        onNewSession={() => setModal("new-session")}
        onOpenSession={(id) => void openSession(id)}
        onOpenExport={() => setModal("export")}
      />

      <main className="flex-1 min-h-0 p-3">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3 h-full min-h-0">
          <div className="min-h-0">
            <BrowserWorkspace api={api} webviewRef={webviewRef} onWebviewApi={setWebviewApi} />
          </div>
          {/* flex-col, not a fixed 1fr/1fr/1fr grid — each panel below sets its own flex-1
              (expanded) or flex-none (collapsed) on its root, so collapsing one panel actually
              frees its space to whichever panels are still expanded, rather than leaving a gap. */}
          <div className="min-h-0 flex flex-col gap-3">
            <CapturedElementsPanel api={api} />
            <LocatorDetailsPanel api={api} webviewRef={webviewRef} />
            <DomInspectorPanel api={api} />
          </div>
        </div>
      </main>

      {modal === "new-session" && (
        <NewSessionModal onCreate={(name, url) => startNewSession(name, url)} onClose={() => setModal(null)} />
      )}
      {modal === "export" && <ExportDialog api={api} onClose={() => setModal(null)} />}

      {webviewApi?.duplicatePrompt && (
        <DuplicatePromptModal outcome={webviewApi.duplicatePrompt} onResolve={webviewApi.resolveDuplicate} />
      )}

      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full">
        {api.toasts.map((t) => {
          const style =
            t.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-150 dark:bg-emerald-900/90 dark:text-white dark:border-emerald-800"
              : t.type === "error"
                ? "bg-rose-50 text-rose-800 border-rose-150 dark:bg-rose-900/90 dark:text-white dark:border-rose-800"
                : "bg-sky-50 text-sky-800 border-sky-150 dark:bg-slate-800/95 dark:text-white dark:border-slate-700";
          const Icon = t.type === "success" ? CheckCircle : t.type === "error" ? AlertCircle : Info;
          return (
            <div
              key={t.id}
              className={`p-3 rounded-xl border shadow-lg flex items-start gap-2.5 pointer-events-auto ${style}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-xs font-semibold leading-relaxed">{t.message}</div>
              <button onClick={() => api.dismissToast(t.id)} className="flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
