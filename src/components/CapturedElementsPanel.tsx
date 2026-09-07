import { ChevronDown, ChevronRight, Copy, Pencil, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CaptureSessionApi } from "@/hooks/useCaptureSession";
import type { CapturedElement } from "@/types";

interface CapturedElementsPanelProps {
  api: CaptureSessionApi;
}

type FilterId = "all" | "xpath" | "css" | "buttons" | "inputs" | "links" | "unique" | "non-unique" | "high" | "low";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "xpath", label: "XPath" },
  { id: "css", label: "CSS" },
  { id: "buttons", label: "Buttons" },
  { id: "inputs", label: "Inputs" },
  { id: "links", label: "Links" },
  { id: "unique", label: "Unique" },
  { id: "non-unique", label: "Non-Unique" },
  { id: "high", label: "High Stability" },
  { id: "low", label: "Low Stability" },
];

function primaryOf(el: CapturedElement) {
  return el.candidates.find((c) => c.id === el.primaryLocatorId) ?? el.candidates[0] ?? null;
}

function matchesFilter(el: CapturedElement, filter: FilterId): boolean {
  const primary = primaryOf(el);
  switch (filter) {
    case "all":
      return true;
    case "xpath":
      return primary?.type.startsWith("xpath") ?? false;
    case "css":
      return primary?.type === "css";
    case "buttons":
      return el.snapshot.tag === "button" || el.snapshot.attributes.type === "submit";
    case "inputs":
      return el.snapshot.tag === "input" || el.snapshot.tag === "select" || el.snapshot.tag === "textarea";
    case "links":
      return el.snapshot.tag === "a";
    case "unique":
      return primary?.validation?.unique ?? false;
    case "non-unique":
      return primary ? !primary.validation?.unique : false;
    case "high":
      return (primary?.score.total ?? 0) >= 70;
    case "low":
      return (primary?.score.total ?? 0) < 40;
    default:
      return true;
  }
}

export default function CapturedElementsPanel({ api }: CapturedElementsPanelProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return api.session.elements.filter((el) => {
      if (!matchesFilter(el, filter)) return false;
      if (!term) return true;
      return (
        el.name.toLowerCase().includes(term) ||
        el.snapshot.tag.includes(term) ||
        primaryOf(el)?.value.toLowerCase().includes(term)
      );
    });
  }, [api.session.elements, search, filter]);

  const selectedIds = api.checkedIds;
  const allVisibleChecked = visible.length > 0 && visible.every((el) => selectedIds.has(el.id));
  const someVisibleChecked = visible.some((el) => selectedIds.has(el.id));

  // Checkboxes don't support an "indeterminate" prop — it's DOM-property-only, so it has to be
  // set imperatively whenever the mixed (some-but-not-all) state changes.
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someVisibleChecked && !allVisibleChecked;
  }, [someVisibleChecked, allVisibleChecked]);

  const toggleSelectAll = () => {
    if (allVisibleChecked) api.clearChecked();
    else api.setAllChecked(visible.map((el) => el.id));
  };

  const startRename = (el: CapturedElement) => {
    setEditingId(el.id);
    setEditingValue(el.name);
  };

  const commitRename = () => {
    if (editingId && editingValue.trim()) api.renameElement(editingId, editingValue.trim());
    setEditingId(null);
  };

  const copyPrimary = async (el: CapturedElement) => {
    const primary = primaryOf(el);
    if (!primary) return;
    await navigator.clipboard.writeText(primary.value);
    api.addToast(`Copied "${el.name}" locator to clipboard.`, "success");
  };

  const deleteSelected = () => {
    if (selectedIds.size === 0) return;
    api.deleteElements(selectedIds);
  };

  return (
    <div
      className={`flex flex-col ${collapsed ? "flex-none" : "flex-1 min-h-0"} bg-white dark:bg-slate-900 rounded-xl border border-slate-150 dark:border-slate-850 overflow-hidden`}
    >
      <div className={`px-3 py-2 flex-shrink-0 ${collapsed ? "" : "border-b border-slate-150 dark:border-slate-850 space-y-2"}`}>
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="flex items-center gap-1.5 min-w-0 text-left"
            title={collapsed ? "Expand" : "Collapse"}
            data-testid="captured-elements-collapse-toggle"
          >
            {collapsed ? (
              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
            )}
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 truncate">
              Captured Elements ({api.session.elements.length})
            </h2>
          </button>
          {!collapsed && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <input
                ref={selectAllRef}
                type="checkbox"
                data-testid="select-all-checkbox"
                checked={allVisibleChecked}
                onChange={toggleSelectAll}
                disabled={visible.length === 0}
                title={allVisibleChecked ? "Deselect all" : "Select all"}
                className="flex-shrink-0"
              />
              {selectedIds.size > 0 && (
                <button
                  onClick={deleteSelected}
                  className="flex-shrink-0 flex items-center gap-1 text-[11px] font-semibold text-rose-500 hover:text-rose-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete {selectedIds.size}
                </button>
              )}
            </div>
          )}
        </div>
        {!collapsed && (
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                data-role="element-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search captured elements… (Ctrl+F)"
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-905 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-slate-100"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                    filter === f.id
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {!collapsed && (
      <div className="flex-1 overflow-y-auto">
        {visible.length === 0 && (
          <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-600">
            {api.session.elements.length === 0
              ? "Ctrl+Click an element in the browser to capture it."
              : "No captured elements match this search/filter."}
          </div>
        )}
        {visible.map((el) => {
          const primary = primaryOf(el);
          const isSelected = api.selectedElementId === el.id;
          return (
            <div
              key={el.id}
              data-testid="captured-element-row"
              onClick={() => api.setSelectedElementId(el.id)}
              className={`group px-3 py-2 border-b border-slate-100 dark:border-slate-850 cursor-pointer transition-colors ${
                isSelected ? "bg-blue-50 dark:bg-blue-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedIds.has(el.id)}
                  onChange={() => api.toggleChecked(el.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-shrink-0"
                />
                {editingId === el.id ? (
                  <input
                    autoFocus
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 min-w-0 px-1.5 py-0.5 text-xs border border-blue-400 rounded dark:bg-slate-900 dark:text-slate-100"
                  />
                ) : (
                  <span className="flex-1 min-w-0 truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                    {el.name}
                  </span>
                )}
                <span className="flex-shrink-0 text-[9px] font-mono uppercase text-slate-400">{el.snapshot.tag}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 pl-6">
                <code className="flex-1 min-w-0 truncate text-[10px] font-mono text-slate-500 dark:text-slate-400">
                  {primary?.value ?? "(no candidates)"}
                </code>
                {primary && (
                  <span
                    className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                      primary.validation?.unique
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                    }`}
                  >
                    {primary.score.total}
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void copyPrimary(el);
                  }}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
                  title="Copy primary locator"
                >
                  <Copy className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startRename(el);
                  }}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
                  title="Rename"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    api.deleteElements(new Set([el.id]));
                  }}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-400"
                  title="Delete"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
