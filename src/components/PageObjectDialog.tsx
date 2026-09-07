// section 48 — Page Object Generation: wraps every captured element's locator (all, or just the
// checked ones) into a single Page Object class for the chosen framework, previewed live and
// either copied to the clipboard or saved to a file via the same native-dialog path Export uses.

import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { FRAMEWORKS } from "@/engine/codegen/frameworks";
import { toPascalCase } from "@/engine/codegen/identifier";
import { getCodeGenerator } from "@/engine/codegen/registry";
import type { CaptureSessionApi } from "@/hooks/useCaptureSession";

interface PageObjectDialogProps {
  api: CaptureSessionApi;
  onClose: () => void;
}

export default function PageObjectDialog({ api, onClose }: PageObjectDialogProps) {
  const [framework, setFramework] = useState(FRAMEWORKS[0].id);
  const [className, setClassName] = useState(() => `${toPascalCase(api.session.name)}Page`);
  const [scope, setScope] = useState<"all" | "selected">(() => (api.checkedIds.size > 0 ? "selected" : "all"));
  const [busy, setBusy] = useState(false);

  const elements = useMemo(
    () => (scope === "all" ? api.session.elements : api.session.elements.filter((el) => api.checkedIds.has(el.id))),
    [scope, api.session.elements, api.checkedIds],
  );

  const generator = getCodeGenerator(framework);
  const preview = generator && elements.length > 0 ? generator.generatePageObject(className || "Page", elements) : "";

  const copy = async () => {
    if (!preview) return;
    await navigator.clipboard.writeText(preview);
    api.addToast("Page Object copied to clipboard.", "success");
  };

  const saveToFile = async () => {
    if (!preview || !generator) return;
    setBusy(true);
    try {
      const result = await window.captureStudio.files.saveFile({
        defaultName: `${toPascalCase(className || "Page")}.${generator.fileExtension}`,
        filters: [{ name: generator.label, extensions: [generator.fileExtension] }],
        content: preview,
      });
      if (result.ok) {
        api.addToast(`Saved to ${result.filePath}.`, "success");
        onClose();
      } else if (!result.canceled) {
        api.addToast("Save failed.", "error");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
      <div
        role="dialog"
        aria-label="Generate Page Object"
        className="w-full max-w-lg max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-150 dark:border-slate-800"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-150 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Generate Page Object</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Class Name</div>
            <input
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              data-testid="page-object-class-name"
              className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-slate-100"
            />
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Framework</div>
            <select
              value={framework}
              onChange={(e) => setFramework(e.target.value)}
              data-testid="page-object-framework-select"
              className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-slate-100"
            >
              {FRAMEWORKS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Scope</div>
            <div className="flex gap-2">
              <button
                onClick={() => setScope("all")}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold ${
                  scope === "all" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}
              >
                All ({api.session.elements.length})
              </button>
              <button
                onClick={() => setScope("selected")}
                disabled={api.checkedIds.size === 0}
                title={api.checkedIds.size === 0 ? "Check some elements in Captured Elements first" : undefined}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold disabled:opacity-40 ${
                  scope === "selected" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}
              >
                Selected ({api.checkedIds.size})
              </button>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Preview</div>
            <pre
              data-testid="page-object-preview"
              className="whitespace-pre-wrap break-all bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-lg p-2 font-mono text-[10px] text-slate-700 dark:text-slate-200 max-h-64 overflow-y-auto"
            >
              {preview || (elements.length === 0 ? "No captured elements in this scope." : "")}
            </pre>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-150 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={() => void copy()}
            disabled={!preview}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            Copy
          </button>
          <button
            onClick={() => void saveToFile()}
            disabled={!preview || busy}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save to File"}
          </button>
        </div>
      </div>
    </div>
  );
}
