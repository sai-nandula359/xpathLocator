import { useState } from "react";
import Modal from "@/components/Modal";

interface BulkRenameModalProps {
  count: number;
  onConfirm: (basePrefix: string) => void;
  onClose: () => void;
}

// Prefix + auto-number rather than a single shared literal name — renaming N elements to the
// exact same string would leave them indistinguishable in the list. Produces "${prefix}_1",
// "${prefix}_2", ... in the selected elements' current session order (see
// useCaptureSession.ts's renameElementsBulk).
export default function BulkRenameModal({ count, onConfirm, onClose }: BulkRenameModalProps) {
  const [prefix, setPrefix] = useState("");
  const trimmed = prefix.trim();

  const confirm = () => {
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <Modal
      title="Bulk Rename"
      onClose={onClose}
      className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-150 dark:border-slate-800 p-4"
    >
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
          Rename {count} Element{count === 1 ? "" : "s"}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          Each selected element will be renamed to this prefix followed by a number, e.g. "NavLink_1", "NavLink_2".
        </p>
        <input
          autoFocus
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirm();
          }}
          placeholder="e.g. NavLink"
          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-905 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-slate-100 mb-3"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={!trimmed}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Rename
          </button>
        </div>
    </Modal>
  );
}
