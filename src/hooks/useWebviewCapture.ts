import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { captureElement, type CaptureOutcome } from "@/session/captureElement";
import type { CaptureSessionApi } from "@/hooks/useCaptureSession";
import type { ElementSnapshot } from "@/types";

interface WebviewIpcMessageEvent extends Event {
  channel: string;
  args: unknown[];
}

export function useWebviewCapture(webviewRef: RefObject<ElectronWebviewElement | null>, api: CaptureSessionApi) {
  const [captureModeEnabled, setCaptureModeEnabled] = useState(true);
  const [url, setUrl] = useState("");
  const [pageTitle, setPageTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [duplicatePrompt, setDuplicatePrompt] = useState<CaptureOutcome | null>(null);
  const [frameNotice, setFrameNotice] = useState<string[] | null>(null);

  // `api` is a fresh object every render (useCaptureSession doesn't memoize its return value),
  // and captureModeEnabled changes on every toggle — closing over either directly in the
  // webview-listener effect below would force it to tear down and reattach on every render.
  // Routing through refs instead lets that effect attach exactly once, for the webview
  // element's whole lifetime, while still always acting on current state.
  const apiRef = useRef(api);
  useEffect(() => {
    apiRef.current = api;
  }, [api]);
  const captureModeRef = useRef(captureModeEnabled);
  useEffect(() => {
    captureModeRef.current = captureModeEnabled;
  }, [captureModeEnabled]);

  const pushCaptureMode = useCallback(
    (enabled: boolean) => {
      // A <webview>'s methods throw synchronously if called before Electron has attached it
      // and fired 'dom-ready' — which can easily happen here, since this runs from a React
      // effect the moment the ref is set, well before that. dom-ready re-sends the current
      // value anyway, so a too-early call failing silently costs nothing.
      try {
        webviewRef.current?.send("set-capture-mode", enabled);
      } catch {
        // not ready yet — dom-ready's own sync call will cover it
      }
    },
    [webviewRef],
  );

  const toggleCaptureMode = useCallback(() => setCaptureModeEnabled((v) => !v), []);

  useEffect(() => {
    pushCaptureMode(captureModeEnabled);
  }, [captureModeEnabled, pushCaptureMode]);

  const handleCaptured = useCallback(
    async (snapshot: ElementSnapshot) => {
      const webview = webviewRef.current;
      if (!webview) return;
      const currentApi = apiRef.current;
      try {
        const outcome = await captureElement(webview, snapshot, currentApi.session);
        if (outcome.duplicateOf) {
          setDuplicatePrompt(outcome);
        } else {
          currentApi.addElement(outcome.element);
          currentApi.addToast(`Captured "${outcome.element.name}".`, "success");
        }
      } catch (err) {
        currentApi.addToast(`Capture failed: ${err instanceof Error ? err.message : String(err)}`, "error");
      }
    },
    [webviewRef],
  );

  const resolveDuplicate = useCallback(
    (resolution: "update" | "new" | "cancel") => {
      if (!duplicatePrompt) return;
      const currentApi = apiRef.current;
      if (resolution === "update" && duplicatePrompt.duplicateOf) {
        currentApi.updateElement(duplicatePrompt.duplicateOf.id, duplicatePrompt.element);
        currentApi.addToast(`Updated "${duplicatePrompt.element.name}".`, "info");
      } else if (resolution === "new") {
        currentApi.addElement(duplicatePrompt.element);
        currentApi.addToast(`Captured "${duplicatePrompt.element.name}" as a new element.`, "success");
      }
      setDuplicatePrompt(null);
    },
    [duplicatePrompt],
  );

  // Attaches once for the webview element's lifetime (it's never remounted across this app's
  // life — "New Session" replaces state, not the DOM node), reading current app state via the
  // refs above rather than needing to reattach when that state changes.
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return undefined;

    const onIpc = (event: Event) => {
      const e = event as WebviewIpcMessageEvent;
      if (e.channel === "element-captured") {
        void handleCaptured(e.args[0] as ElementSnapshot);
      } else if (e.channel === "exit-capture-mode") {
        setCaptureModeEnabled(false);
      } else if (e.channel === "toggle-capture-mode") {
        setCaptureModeEnabled((v) => !v);
      } else if (e.channel === "frame-notice") {
        const payload = e.args[0] as { crossOriginFrames: string[] };
        if (payload.crossOriginFrames.length > 0) setFrameNotice(payload.crossOriginFrames);
      } else if (e.channel === "navigated") {
        const payload = e.args[0] as { url: string; title: string };
        setUrl(payload.url);
        setPageTitle(payload.title);
      }
    };

    const syncNavState = () => {
      setCanGoBack(webview.canGoBack());
      setCanGoForward(webview.canGoForward());
      setUrl(webview.getURL());
      apiRef.current.setCurrentUrl(webview.getURL());
    };

    const onDomReady = () => {
      pushCaptureMode(captureModeRef.current);
      syncNavState();
    };
    const onStartLoading = () => setIsLoading(true);
    const onStopLoading = () => setIsLoading(false);

    webview.addEventListener("ipc-message", onIpc);
    webview.addEventListener("dom-ready", onDomReady);
    webview.addEventListener("did-navigate", syncNavState);
    webview.addEventListener("did-navigate-in-page", syncNavState);
    webview.addEventListener("did-start-loading", onStartLoading);
    webview.addEventListener("did-stop-loading", onStopLoading);

    return () => {
      webview.removeEventListener("ipc-message", onIpc);
      webview.removeEventListener("dom-ready", onDomReady);
      webview.removeEventListener("did-navigate", syncNavState);
      webview.removeEventListener("did-navigate-in-page", syncNavState);
      webview.removeEventListener("did-start-loading", onStartLoading);
      webview.removeEventListener("did-stop-loading", onStopLoading);
    };
  }, [webviewRef, handleCaptured, pushCaptureMode]);

  const navigateTo = useCallback(
    (targetUrl: string) => {
      const webview = webviewRef.current;
      if (!webview || !targetUrl.trim()) return;
      const normalized = /^[a-z]+:\/\//i.test(targetUrl) ? targetUrl : `https://${targetUrl}`;
      webview.loadURL(normalized).catch(() => apiRef.current.addToast("Failed to load that URL.", "error"));
    },
    [webviewRef],
  );

  return {
    captureModeEnabled,
    toggleCaptureMode,
    setCaptureModeEnabled,
    url,
    pageTitle,
    isLoading,
    canGoBack,
    canGoForward,
    duplicatePrompt,
    resolveDuplicate,
    frameNotice,
    dismissFrameNotice: () => setFrameNotice(null),
    navigateTo,
  };
}

export type WebviewCaptureApi = ReturnType<typeof useWebviewCapture>;
