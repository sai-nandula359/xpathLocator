// Manual locator disambiguation — the interactive counterpart to the fully-automatic pipeline.
// Inspired by a reference tool's "Resolve Duplicate Match" dialog: lets the user pick which of
// the captured element's own attributes to combine into a //tag[@a='x' and @b='y'] predicate,
// with live match-count feedback against the real DOM as they toggle checkboxes, plus an
// explicit "wrap with position" last resort (the same indexed-disambiguation machinery
// session/captureElement.ts already uses automatically) for when no combination is unique. This
// exists for the case pure automation can't help with: the user knows better than the engine
// which attributes actually matter and wants to say so directly.

import { Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import { buildCustomXPath } from "@/engine/customLocator";
import { isDynamicAttributeName, isDynamicValue } from "@/engine/dynamicAttributeDetector";
import { scoreCandidate } from "@/engine/scorer";
import { generateAbsolute } from "@/engine/xpath/absolute";
import { nextId } from "@/engine/xpath/util";
import { findMatchIndex, validateCandidate } from "@/session/liveValidate";
import type { CapturedElement, LocatorCandidate, ValidationResult } from "@/types";

interface CustomLocatorBuilderModalProps {
  element: CapturedElement;
  webviewRef: React.RefObject<ElectronWebviewElement | null>;
  onClose: () => void;
  onSave: (candidate: LocatorCandidate) => void;
}

interface LivePreview {
  value: string;
  validation?: ValidationResult;
  error?: string;
}

const ZERO_SCORE = {
  uniqueness: 0,
  attributeStability: 0,
  domDependency: 0,
  readability: 0,
  length: 0,
  dynamicRisk: 0,
  total: 0,
};

function usesDynamicAttribute(attributes: Record<string, string>, names: string[]): boolean {
  return names.some((name) => isDynamicAttributeName(name) || isDynamicValue(attributes[name] ?? ""));
}

function draftCandidate(type: LocatorCandidate["type"], value: string, attributeName: string | undefined, dynamic: boolean): LocatorCandidate {
  return {
    id: "draft",
    type,
    value,
    usesDynamicAttribute: dynamic,
    attributeName,
    score: { ...ZERO_SCORE },
    classification: "fallback",
  };
}

export default function CustomLocatorBuilderModal({ element, webviewRef, onClose, onSave }: CustomLocatorBuilderModalProps) {
  const { tag, attributes } = element.snapshot;
  const attrEntries = Object.entries(attributes);

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [usePosition, setUsePosition] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<LivePreview | null>(null);
  const [saving, setSaving] = useState(false);

  const toggle = (name: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  useEffect(() => {
    const names = Array.from(checked);
    const baseValue = buildCustomXPath(tag, attributes, names);
    if (!baseValue) {
      setPreview(null);
      return;
    }

    const webview = webviewRef.current;
    if (!webview) {
      setPreview({ value: baseValue, error: "No live page to validate against." });
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const dynamic = usesDynamicAttribute(attributes, names);
          const attributeName = names.length === 1 ? names[0] : undefined;

          const frameSrc = element.snapshot.frameSrc;

          if (!usePosition) {
            const candidate = draftCandidate(names.length > 1 ? "xpath-combination" : "xpath-attribute", baseValue, attributeName, dynamic);
            const validation = await validateCandidate(webview, candidate, frameSrc);
            if (!cancelled) setPreview({ value: baseValue, validation });
            return;
          }

          const groundTruth = generateAbsolute(element.snapshot)[0];
          if (!groundTruth) {
            if (!cancelled) setPreview({ value: baseValue, error: "No ancestor chain captured — can't determine this element's position." });
            return;
          }
          const baseCandidate = draftCandidate(names.length > 1 ? "xpath-combination" : "xpath-attribute", baseValue, attributeName, dynamic);
          const index = await findMatchIndex(webview, baseCandidate, groundTruth.value, frameSrc);
          if (index === null) {
            if (!cancelled) setPreview({ value: baseValue, error: "Couldn't find this element among that predicate's matches." });
            return;
          }
          const wrapped = `(${baseValue})[${index}]`;
          const indexedCandidate = draftCandidate("xpath-indexed", wrapped, attributeName, dynamic);
          const validation = await validateCandidate(webview, indexedCandidate, frameSrc);
          if (!cancelled) setPreview({ value: wrapped, validation });
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, usePosition]);

  const save = () => {
    if (!preview?.validation) return;
    const names = Array.from(checked);
    const attributeName = names.length === 1 ? names[0] : undefined;
    const dynamic = usesDynamicAttribute(attributes, names);
    const type: LocatorCandidate["type"] = usePosition ? "xpath-indexed" : names.length > 1 ? "xpath-combination" : "xpath-attribute";
    const candidate: LocatorCandidate = {
      id: nextId("loc"),
      type,
      value: preview.value,
      usesDynamicAttribute: dynamic,
      attributeName,
      score: { ...ZERO_SCORE },
      classification: "fallback",
      validation: preview.validation,
    };
    candidate.score = scoreCandidate(candidate, candidate.validation);
    setSaving(true);
    onSave(candidate);
  };

  const canSave = !loading && !saving && !!preview?.validation?.valid;

  return (
    <Modal
      title="Build Custom Locator"
      onClose={onClose}
      className="w-full max-w-lg max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-150 dark:border-slate-800"
    >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-150 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Build Custom Locator</h2>
            <div className="text-[10px] text-slate-400 truncate">{element.name}</div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Pick which attributes to combine — the preview below validates against the live page as you go.
          </p>

          <div className="rounded-lg border border-slate-150 dark:border-slate-800 overflow-hidden">
            {attrEntries.length === 0 && <div className="px-2 py-1.5 text-[11px] text-slate-400">No attributes on this element.</div>}
            {attrEntries.map(([name, value]) => (
              <label
                key={name}
                className="flex items-center gap-2 px-2 py-1.5 text-[11px] border-b last:border-b-0 border-slate-100 dark:border-slate-850 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <input type="checkbox" checked={checked.has(name)} onChange={() => toggle(name)} className="flex-shrink-0" />
                <span className="font-mono text-slate-500 dark:text-slate-400">@{name}</span>
                <span className="font-mono text-slate-700 dark:text-slate-200 truncate">= "{value}"</span>
              </label>
            ))}
          </div>

          <label className="flex items-start gap-2 px-2 py-1.5 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 cursor-pointer">
            <input type="checkbox" checked={usePosition} onChange={(e) => setUsePosition(e.target.checked)} className="flex-shrink-0 mt-0.5" />
            <span className="text-[11px] text-amber-700 dark:text-amber-400">
              <span className="font-semibold">Wrap with position (fragile)</span> — use only when no attribute
              combination is unique on its own; breaks if the DOM order of matches changes.
            </span>
          </label>

          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Preview</h3>
            <div className="rounded-lg border border-slate-150 dark:border-slate-800 p-2 min-h-[3.5rem]">
              {!preview && <div className="text-[11px] text-slate-400">Check an attribute to build a locator.</div>}
              {preview && (
                <>
                  <code className="block text-[11px] font-mono text-slate-700 dark:text-slate-200 break-all">{preview.value}</code>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {loading && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                    {!loading && preview.error && <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">{preview.error}</span>}
                    {!loading && preview.validation && (
                      <span
                        className={`text-[10px] font-semibold ${
                          preview.validation.unique
                            ? "text-emerald-600 dark:text-emerald-400"
                            : preview.validation.valid
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {preview.validation.valid
                          ? `${preview.validation.matchCount} match${preview.validation.matchCount === 1 ? "" : "es"} · ${preview.validation.unique ? "Unique" : "Non-Unique"}`
                          : `Invalid: ${preview.validation.error ?? "error"}`}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-150 dark:border-slate-800">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!canSave}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add as Candidate"}
          </button>
        </div>
    </Modal>
  );
}
