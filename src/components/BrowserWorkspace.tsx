import { ArrowLeft, ArrowRight, Loader2, RotateCcw, RotateCw, Smartphone, X } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import type { CaptureSessionApi } from "@/hooks/useCaptureSession";
import { DEVICE_CATEGORIES, DEVICE_PRESETS, findDevicePreset } from "@/devicePresets";
import { useWebviewCapture, type WebviewCaptureApi } from "@/hooks/useWebviewCapture";

interface BrowserWorkspaceProps {
  api: CaptureSessionApi;
  webviewRef: RefObject<ElectronWebviewElement | null>;
  onWebviewApi: (webviewApi: WebviewCaptureApi) => void;
}

const DESKTOP_DEVICE_ID = "desktop";
const RESPONSIVE_DEVICE_ID = "responsive";
const DEFAULT_CUSTOM_SIZE = { width: 1280, height: 800 };

export default function BrowserWorkspace({ api, webviewRef, onWebviewApi }: BrowserWorkspaceProps) {
  const [addressBarValue, setAddressBarValue] = useState(api.session.baseUrl);
  const webviewApi = useWebviewCapture(webviewRef, api);

  // Responsive device emulation — resizes the webview's rendered viewport (and, for phones/
  // tablets, its user agent) to a real device's, the same way Chrome DevTools' device toolbar
  // does. Ctrl+Click capture needs no changes for this at all: webview-preload.cjs already reads
  // whatever the guest page's own layout reports, which correctly reflects the emulated viewport
  // once Electron's device emulation is active.
  const [deviceId, setDeviceId] = useState(DESKTOP_DEVICE_ID);
  const [rotated, setRotated] = useState(false);
  const [customSize, setCustomSize] = useState(DEFAULT_CUSTOM_SIZE);
  // Captured once, before any device emulation ever swaps it, so "Desktop" can restore the
  // browser's real default user agent rather than being stuck on the last device's.
  const defaultUserAgentRef = useRef<string | null>(null);

  // The active preset's own (unrotated) profile — width/height plus scale factor/mobile flag/UA
  // — for either a named device or a Responsive/custom size (which only has width/height; the
  // rest are plain desktop defaults). Null on Desktop, where nothing is emulated at all.
  const activePreset =
    deviceId === DESKTOP_DEVICE_ID
      ? null
      : deviceId === RESPONSIVE_DEVICE_ID
        ? { width: customSize.width, height: customSize.height, deviceScaleFactor: 1, mobile: false, userAgent: "" }
        : findDevicePreset(deviceId);
  // Rotate swaps width/height uniformly for a named preset and a Responsive/custom size alike —
  // this is also exactly what's sent to enableDeviceEmulation below, so the webview's visual
  // frame size and its actual emulated viewport never drift apart.
  const frameSize = activePreset ? { width: rotated ? activePreset.height : activePreset.width, height: rotated ? activePreset.width : activePreset.height } : null;

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview || defaultUserAgentRef.current) return;
    try {
      const ua = webview.getUserAgent();
      if (ua) defaultUserAgentRef.current = ua;
    } catch {
      // Not attached yet — retried on the next url change below.
    }
  }, [webviewApi.url, webviewRef]);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;
    let cancelled = false;

    void (async () => {
      let contentsId: number;
      try {
        contentsId = webview.getWebContentsId();
      } catch {
        return; // not attached yet — retried on the next url change below
      }
      if (cancelled) return;

      // setUserAgent() makes Chromium reload the page (so future requests carry the new UA),
      // which in turn fires a url/navigation event that re-runs this very effect — only calling
      // it when the UA is actually changing breaks that potential reload loop, and avoids the
      // benign-but-noisy ERR_ABORTED a redundant reload-mid-reload produces.
      const setUserAgentIfChanged = (ua: string) => {
        if (ua && webview.getUserAgent() !== ua) webview.setUserAgent(ua);
      };

      if (!activePreset || !frameSize) {
        await window.captureStudio.device.disableEmulation(contentsId);
        if (defaultUserAgentRef.current) setUserAgentIfChanged(defaultUserAgentRef.current);
        return;
      }

      // screenPosition deliberately always "desktop", even for phone/tablet presets: Electron's
      // "mobile" mode inflates the reported window.innerWidth/innerHeight by a spurious ~2.6x
      // factor regardless of deviceScaleFactor (confirmed by direct comparison — "desktop" with
      // the exact same viewSize/screenSize reports precisely correct, correctly-DPR-scaled
      // dimensions). The trade-off is losing Chromium's touch/hover-media-query emulation that
      // "mobile" mode would otherwise add — viewport-width-driven responsive behavior (what
      // actually matters for capturing locators at a given breakpoint) still works exactly right.
      await window.captureStudio.device.enableEmulation(contentsId, {
        screenPosition: "desktop",
        screenSize: frameSize,
        viewPosition: { x: 0, y: 0 },
        deviceScaleFactor: activePreset.deviceScaleFactor,
        viewSize: frameSize,
        scale: 1,
      });
      setUserAgentIfChanged(activePreset.userAgent || defaultUserAgentRef.current || "");
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, rotated, customSize.width, customSize.height, webviewApi.url, webviewRef]);

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

        <div className="flex items-center gap-1 flex-shrink-0">
          <Smartphone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <select
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            data-testid="device-select"
            title="Emulate a device/resolution — Ctrl+Click still captures within it"
            className="px-2 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-slate-100"
          >
            <option value={DESKTOP_DEVICE_ID}>Desktop (No Emulation)</option>
            <option value={RESPONSIVE_DEVICE_ID}>Responsive (Custom)</option>
            {DEVICE_CATEGORIES.map((category) => (
              <optgroup key={category} label={category}>
                {DEVICE_PRESETS.filter((d) => d.category === category).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label} ({d.width}×{d.height})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          {deviceId === RESPONSIVE_DEVICE_ID && (
            <>
              <input
                type="number"
                min={200}
                value={customSize.width}
                onChange={(e) => setCustomSize((s) => ({ ...s, width: Number(e.target.value) || s.width }))}
                data-testid="device-custom-width"
                className="w-16 px-1.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-slate-100"
              />
              <span className="text-slate-400 text-[11px]">×</span>
              <input
                type="number"
                min={200}
                value={customSize.height}
                onChange={(e) => setCustomSize((s) => ({ ...s, height: Number(e.target.value) || s.height }))}
                data-testid="device-custom-height"
                className="w-16 px-1.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-slate-100"
              />
            </>
          )}

          {deviceId !== DESKTOP_DEVICE_ID && (
            <button
              onClick={() => setRotated((v) => !v)}
              title="Rotate"
              data-testid="device-rotate"
              className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-slate-800"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
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

      {webviewApi.pageError && (
        <div
          data-testid="page-error-banner"
          className="flex items-center justify-between gap-3 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900 text-[11px] text-rose-700 dark:text-rose-300"
        >
          <span className="truncate">{webviewApi.pageError.message}</span>
          <div className="flex-shrink-0 flex items-center gap-2">
            {(webviewApi.pageError.kind === "crashed" || webviewApi.pageError.kind === "unresponsive") && (
              <button
                onClick={() => {
                  webviewRef.current?.reload();
                  webviewApi.dismissPageError();
                }}
                className="font-semibold underline"
              >
                Reload
              </button>
            )}
            <button onClick={webviewApi.dismissPageError}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className={`relative flex-1 min-h-0 bg-slate-100 dark:bg-slate-950 ${frameSize ? "overflow-auto" : ""}`}>
        <div
          className={frameSize ? "flex justify-center py-4" : "w-full h-full"}
          style={frameSize ? { minHeight: "100%" } : undefined}
        >
          <webview
            ref={webviewRef}
            src={api.session.baseUrl || "about:blank"}
            preload={window.captureStudio.webviewPreloadPath}
            partition="persist:capture-session"
            allowpopups
            className={frameSize ? "flex-shrink-0 border border-slate-300 dark:border-slate-700 rounded-lg shadow-lg" : "w-full h-full"}
            style={frameSize ? { width: frameSize.width, height: frameSize.height } : undefined}
          />
        </div>
        {!api.session.baseUrl && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400 dark:text-slate-600 pointer-events-none">
            Enter a URL above to start browsing.
          </div>
        )}
      </div>
    </div>
  );
}
