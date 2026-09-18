import { Check, ChevronDown, Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CaptureSessionApi } from "@/hooks/useCaptureSession";
import { deleteSession, listSessions } from "@/session/sessionStore";

interface SessionDropdownProps {
  api: CaptureSessionApi;
  onNewSession: () => void;
  onOpenSession: (id: string) => void;
  onImportSession: () => void;
}

/** Header control consolidating New Session / Open Session / delete into one dropdown: the
 * button always shows whichever session is currently active (defaulting to the most recently
 * created one, since that's whatever `api.session` currently is), and the panel lists every
 * saved session with a delete action right on each row. */
export default function SessionDropdown({ api, onNewSession, onOpenSession, onImportSession }: SessionDropdownProps) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const refresh = () => {
    listSessions()
      .then(setSessions)
      .catch(() => setSessions([]));
  };

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  const handleDelete = async (session: SessionSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm(`Delete saved session "${session.name}"? This can't be undone.`);
    if (!confirmed) return;
    setDeletingId(session.id);
    try {
      await deleteSession(session.id);
      setSessions((prev) => prev?.filter((s) => s.id !== session.id) ?? prev);
      api.addToast("Session deleted.", "info");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 max-w-[220px] transition-colors"
        title={`Current session: ${api.session.name}`}
      >
        <span className="truncate">{api.session.name}</span>
        <span className="flex-shrink-0 text-slate-400 dark:text-slate-500 font-normal">
          ({api.session.elements.length})
        </span>
        <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden">
          <button
            onClick={() => {
              onNewSession();
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Session
          </button>
          <button
            onClick={() => {
              onImportSession();
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Import Session…
          </button>

          <div className="max-h-72 overflow-y-auto">
            {sessions === null && <div className="p-3 text-center text-[11px] text-slate-400">Loading…</div>}
            {sessions?.length === 0 && (
              <div className="p-3 text-center text-[11px] text-slate-400">No saved sessions yet.</div>
            )}
            {sessions?.map((s) => {
              const isActive = s.id === api.session.id;
              return (
                <div
                  key={s.id}
                  className={`group flex items-center gap-1 px-1 transition-colors ${
                    isActive ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <button
                    onClick={() => {
                      onOpenSession(s.id);
                      setOpen(false);
                    }}
                    className="flex-1 min-w-0 text-left px-2 py-2"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100">
                      <span className="truncate">{s.name}</span>
                      {isActive && <Check className="w-3 h-3 text-blue-500 flex-shrink-0" />}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">{s.baseUrl}</div>
                    <div className="text-[10px] text-slate-400">
                      {s.elementCount} elements · updated {new Date(s.updatedAt).toLocaleString()}
                    </div>
                  </button>
                  <button
                    onClick={(e) => void handleDelete(s, e)}
                    disabled={deletingId === s.id}
                    className="flex-shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-400 disabled:opacity-50 transition-opacity"
                    title="Delete this saved session"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
