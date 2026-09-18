// Shared dialog wrapper — before this, every modal (Export/PageObject/NewSession/
// DuplicatePrompt/CustomLocatorBuilder) hand-rolled its own overlay with no focus management at
// all: no `aria-modal`, no initial focus, no focus trap (Tab could leave the dialog into the page
// behind it), no focus restoration on close, and no click-outside-to-dismiss. Escape is
// deliberately NOT handled here — it stays with App.tsx's existing global keydown handler, which
// every modal already relies on to close, so there's no double-handling.

import { useEffect, useRef } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Panel sizing/visual classes (width, max-height, background, border, ...) — every modal
   * wants a different width/layout, so this isn't hardcoded here. */
  className?: string;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null, // visible only — excludes anything hidden/collapsed
  );
}

export default function Modal({ title, onClose, children, className }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Don't steal focus from a field that already claimed it via its own `autoFocus` — that runs
    // during the same render commit, before this effect, so document.activeElement already
    // reflects it here.
    if (panel && !panel.contains(document.activeElement)) {
      focusableIn(panel)[0]?.focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !panelRef.current) return;
      const nodes = focusableIn(panelRef.current);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={
          className ??
          "w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-150 dark:border-slate-800"
        }
      >
        {children}
      </div>
    </div>
  );
}
