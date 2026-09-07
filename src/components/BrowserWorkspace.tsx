import { ArrowLeft, ArrowRight, Loader2, RotateCw, X } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import type { CaptureSessionApi } from "@/hooks/useCaptureSession";
import { useWebviewCapture, type WebviewCaptureApi } from "@/hooks/useWebviewCapture";

interface BrowserWorkspaceProps {
  api: CaptureSessionApi;
  webviewRef: RefObject<ElectronWebviewElement | null>;
  onWebviewApi: (webviewApi: WebviewCaptureApi) => void;
}

export default function BrowserWorkspace({ api, webviewRef, onWebviewApi }: BrowserWorkspaceProps) {
  const [addressBarValue, setAddressBarValue] = useState(api.session.baseUrl);
  const webviewApi = useWebviewCapture(webviewRef, api);

  useEffect(() => onWebviewApi(webviewApi), [webviewApi, onWebviewApi]);
  useEffect(() => setAddressBarValue(webviewApi.url || api.session.baseUrl), [webviewApi.url, api.session.baseUrl]);

  // Forces a real navigation for the one case the <webview>'s declarative `src` attribute can't
  // handle on its own: a *new* session (different session id) whose starting URL happens to be
  // the same string as whatever was already loaded (e.g. testing repeatedly against the same
  // site). React only touches the DOM `src` attribute when its *value* changes — same URL in,
  // same URL out, so nothing tells the webview to reload, and it silently keeps showing whatever
  // page state it was already in. Session data (name, captured elements) resets correctly
  // either way; only the browser content was getting stuck, which read as "New Session did
  // nothing." When the URL *does* change, the declarative `src` prop already handles it — this
  // deliberately does *not* also call loadURL() in that case, since doing so raced against
  // React's own update and produced a benign-but-noisy ERR_ABORTED console error.
  const prevSessionRef = useRef<{ id: string; baseUrl: string } | null>(null);
  useEffect(() => {
    const prev = prevSessionRef.current;
    prevSessionRef.current = { id: api.session.id, baseUrl: api.session.baseUrl };
    if (!prev || prev.id === api.session.id) return; // first mount, or not a new session
    if (prev.baseUrl !== api.session.baseUrl) return; // src's value changed — already handled

    const webview = webviewRef.current;
    if (!webview) return;
    try {
      webview.loadURL(api.session.baseUrl || "about:blank").catch(() => {
        api.addToast("Failed to load that URL.", "error");
      });
    } catch {
      // webview not fully attached yet — nothing to recover here, matches the same defensive
      // pattern useWebviewCapture.ts's pushCaptureMode uses for the same class of race.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.session.id, api.session.baseUrl]);

  const goToAddressBar = (e: React.FormEvent) => {
    e.preventDefault();
    webviewApi.navigateTo(addressBarValue);
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-white dark:bg-slate-900 rounded-xl border border-slate-150 dark:border-slate-850 overflow-hidden card-charm">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-150 dark:border-slate-850 bg-slate-50/60 dark:bg-slate-905">
        <button
          onClick={() => webviewRef.current?.goBack()}
          disabled={!webviewApi.canGoBack}
          className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => webviewRef.current?.goForward()}
          disabled={!webviewApi.canGoForward}
          className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => webviewRef.current?.reload()}
          className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-slate-800"
        >
          {webviewApi.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
        </button>

        <form onSubmit={goToAddressBar} className="flex-1 min-w-0">
          <input
            value={addressBarValue}
            onChange={(e) => setAddressBarValue(e.target.value)}
            placeholder="Enter a URL and press Enter…"
            className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-slate-100"
          />
        </form>
      </div>

      {webviewApi.frameNotice && (
        <div className="flex items-center justify-between gap-3 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 text-[11px] text-amber-700 dark:text-amber-300">
          <span>
            {webviewApi.frameNotice.length} cross-origin iframe(s) on this page can&apos;t be inspected (browser
            same-origin policy) — elements inside {webviewApi.frameNotice.length === 1 ? "it aren't" : "them aren't"}{" "}
            capturable in this release.
          </span>
          <button onClick={webviewApi.dismissFrameNotice} className="flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="relative flex-1 min-h-0 bg-slate-100 dark:bg-slate-950">
        <webview
          ref={webviewRef}
          src={api.session.baseUrl || "about:blank"}
          preload={window.captureStudio.webviewPreloadPath}
          partition="persist:capture-session"
          allowpopups
          className="w-full h-full"
        />
        {!api.session.baseUrl && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400 dark:text-slate-600 pointer-events-none">
            Enter a URL above to start browsing.
          </div>
        )}
      </div>
    </div>
  );
}
