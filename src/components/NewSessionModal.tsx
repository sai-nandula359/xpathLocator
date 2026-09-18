import { X } from "lucide-react";
import { useState } from "react";
import Modal from "@/components/Modal";

interface NewSessionModalProps {
  onCreate: (name: string, baseUrl: string) => void;
  onClose: () => void;
}

export default function NewSessionModal({ onCreate, onClose }: NewSessionModalProps) {
  const [name, setName] = useState("Untitled Session");
  const [url, setUrl] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = url.trim() && !/^[a-z]+:\/\//i.test(url) ? `https://${url.trim()}` : url.trim();
    onCreate(name.trim() || "Untitled Session", normalized);
    onClose();
  };

  return (
    <Modal
      title="New Capture Session"
      onClose={onClose}
      className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-150 dark:border-slate-800"
    >
      {/* display:contents so the form's own box doesn't affect the panel's layout — the panel
          (Modal's own div) already carries the background/border/sizing/role="dialog". */}
      <form onSubmit={submit} className="contents">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-150 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">New Capture Session</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-xs">
          <div>
            <label
              htmlFor="new-session-name"
              className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1"
            >
              Session Name
            </label>
            <input
              id="new-session-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-slate-100"
            />
          </div>
          <div>
            <label
              htmlFor="new-session-url"
              className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1"
            >
              Starting URL
            </label>
            <input
              id="new-session-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="example.com"
              className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-slate-100"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-150 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button type="submit" className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700">
            Create
          </button>
        </div>
      </form>
    </Modal>
  );
}
