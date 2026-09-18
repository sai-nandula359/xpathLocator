import Modal from "@/components/Modal";
import type { CaptureOutcome } from "@/session/captureElement";

interface DuplicatePromptModalProps {
  outcome: CaptureOutcome;
  onResolve: (resolution: "update" | "new" | "cancel") => void;
}

export default function DuplicatePromptModal({ outcome, onResolve }: DuplicatePromptModalProps) {
  return (
    <Modal
      title="Possible Duplicate Capture"
      onClose={() => onResolve("cancel")}
      className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-150 dark:border-slate-800 p-4"
    >
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">Possible Duplicate Capture</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          This looks like the same element as <span className="font-semibold">{outcome.duplicateOf?.name}</span>,
          already in this session.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onResolve("update")}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 text-left"
          >
            Update Existing — replace its locators with this capture
          </button>
          <button
            onClick={() => onResolve("new")}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-left"
          >
            Create New — capture as a separate element
          </button>
          <button
            onClick={() => onResolve("cancel")}
            className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
          >
            Cancel
          </button>
        </div>
    </Modal>
  );
}
