import { useCallback, useEffect, useMemo, useState } from "react";
import { createEmptySession, saveSession as persistSession } from "@/session/sessionStore";
import type { CapturedElement, CaptureSession } from "@/types";

// How long to wait after the last change before writing the session to disk — long enough to
// coalesce a burst of rapid edits (e.g. a capture immediately followed by a rename) into one
// write, short enough that a session switch or app close moments later doesn't lose anything.
const AUTOSAVE_DEBOUNCE_MS = 300;

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

export function useCaptureSession() {
  const [session, setSession] = useState<CaptureSession>(() => createEmptySession("Untitled Session", ""));
  // False until the user actually creates or opens a session — the initial placeholder session
  // above only exists so `session` is never null; it was never asked for and autosaving it would
  // just litter the sessions directory with an empty "Untitled Session" on every launch.
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  // Multi-select (checkbox) state, distinct from selectedElementId (which element is loaded in
  // the details panel) — lifted up here rather than kept local to CapturedElementsPanel so both
  // it (delete) and ExportDialog (export scope) can act on the same selection.
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast["type"] = "success") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const selectedElement = useMemo<CapturedElement | null>(
    () => session.elements.find((el) => el.id === selectedElementId) ?? null,
    [session.elements, selectedElementId],
  );

  const startNewSession = useCallback(
    (name: string, baseUrl: string) => {
      const next = createEmptySession(name, baseUrl);
      setHasActiveSession(true);
      setSession(next);
      setSelectedElementId(null);
      setCheckedIds(new Set());
      // Persisted immediately (not just left to the debounced autosave below) so a brand-new
      // session shows up in the session dropdown/list right away, rather than only after the
      // user happens to make an edit or wait out the debounce.
      persistSession(next).catch(() => {
        addToast("Couldn't save the new session to disk.", "error");
      });
    },
    [addToast],
  );

  const replaceSession = useCallback((next: CaptureSession) => {
    setHasActiveSession(true);
    setSession(next);
    setSelectedElementId(null);
    setCheckedIds(new Set());
  }, []);

  const toggleChecked = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setAllChecked = useCallback((ids: string[]) => {
    setCheckedIds(new Set(ids));
  }, []);

  const clearChecked = useCallback(() => {
    setCheckedIds(new Set());
  }, []);

  const setCurrentUrl = useCallback((url: string) => {
    setSession((prev) => ({ ...prev, currentUrl: url, updatedAt: new Date().toISOString() }));
  }, []);

  const addElement = useCallback((element: CapturedElement) => {
    setSession((prev) => ({
      ...prev,
      elements: [...prev.elements, element],
      updatedAt: new Date().toISOString(),
    }));
    setSelectedElementId(element.id);
  }, []);

  const updateElement = useCallback((id: string, element: CapturedElement) => {
    setSession((prev) => ({
      ...prev,
      elements: prev.elements.map((el) =>
        el.id === id ? { ...element, id, version: el.version + 1, updatedAt: new Date().toISOString() } : el,
      ),
      updatedAt: new Date().toISOString(),
    }));
    setSelectedElementId(id);
  }, []);

  const renameElement = useCallback((id: string, name: string) => {
    setSession((prev) => ({
      ...prev,
      elements: prev.elements.map((el) =>
        el.id === id ? { ...el, name, updatedAt: new Date().toISOString() } : el,
      ),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const deleteElements = useCallback((ids: Set<string>) => {
    setSession((prev) => ({
      ...prev,
      elements: prev.elements.filter((el) => !ids.has(el.id)),
      updatedAt: new Date().toISOString(),
    }));
    setSelectedElementId((prev) => (prev && ids.has(prev) ? null : prev));
    setCheckedIds((prev) => {
      if (![...prev].some((id) => ids.has(id))) return prev;
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  const setPrimaryLocator = useCallback((elementId: string, candidateId: string) => {
    setSession((prev) => ({
      ...prev,
      elements: prev.elements.map((el) =>
        el.id === elementId ? { ...el, primaryLocatorId: candidateId } : el,
      ),
    }));
  }, []);

  const saveSession = useCallback(async () => {
    await persistSession(session);
    addToast(`Session "${session.name}" saved.`, "success");
  }, [session, addToast]);

  // Autosave — this is the actual fix for "my session disappeared"/"my captures got lost":
  // previously nothing wrote to disk except an explicit Ctrl+S or the Save button, so a new
  // session that hadn't been manually saved yet didn't exist on disk at all (wouldn't show up in
  // the session dropdown), and any edits since the last manual save were silently discarded by
  // switching sessions or closing the app. Debounced so a burst of edits coalesces into one write
  // rather than a write per keystroke/click.
  useEffect(() => {
    if (!hasActiveSession) return;
    const timer = setTimeout(() => {
      persistSession(session).catch(() => {
        addToast("Autosave failed — press Ctrl+S to save manually.", "error");
      });
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [session, hasActiveSession, addToast]);

  return {
    session,
    hasActiveSession,
    selectedElement,
    selectedElementId,
    setSelectedElementId,
    checkedIds,
    toggleChecked,
    setAllChecked,
    clearChecked,
    toasts,
    addToast,
    dismissToast,
    startNewSession,
    replaceSession,
    setCurrentUrl,
    addElement,
    updateElement,
    renameElement,
    deleteElements,
    setPrimaryLocator,
    saveSession,
  };
}

export type CaptureSessionApi = ReturnType<typeof useCaptureSession>;
