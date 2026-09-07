import { X } from "lucide-react";
import { useState } from "react";
import { exportSession, type ExportFormat, type ExportScope } from "@/export";
import type { CaptureSessionApi } from "@/hooks/useCaptureSession";

interface ExportDialogProps {
  api: CaptureSessionApi;
  onClose: () => void;
}

export default function ExportDialog({ api, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("json");
  // Defaults to "selected" when the user already has a checkbox selection from Captured
  // Elements — that's almost always why they're opening Export right after checking some boxes.
  const [scope, setScope] = useState<ExportScope>(() => (api.checkedIds.size > 0 ? "selected" : "all"));
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const result = await exportSession(api.session, format, scope, api.checkedIds);
      if (result.ok) {
        api.addToast(`Exported to ${result.filePath}.`, "success");
        onClose();
      } else if (!result.canceled) {
        api.addToast("Export failed.", "error");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-150 dark:border-slate-800">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-150 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Export Session</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-4 text-xs">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Format</div>
            <div className="flex gap-2">
              {(["json", "txt", "csv"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-semibold uppercase ${
                    format === f ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
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
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-150 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={() => void run()}
            disabled={busy || (scope === "all" ? api.session.elements.length === 0 : api.checkedIds.size === 0)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Exporting…" : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
}
