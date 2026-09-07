import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { CaptureSessionApi } from "@/hooks/useCaptureSession";

interface DomInspectorPanelProps {
  api: CaptureSessionApi;
}

export default function DomInspectorPanel({ api }: DomInspectorPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const el = api.selectedElement;

  const collapseToggle = (
    <button
      onClick={() => setCollapsed((v) => !v)}
      className="flex items-center gap-1.5 min-w-0 text-left"
      title={collapsed ? "Expand" : "Collapse"}
      data-testid="dom-inspector-collapse-toggle"
    >
      {collapsed ? (
        <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
      ) : (
        <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
      )}
      <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 truncate">
        DOM Inspector
      </h2>
    </button>
  );

  if (!el) {
    return (
      <div className={`flex flex-col ${collapsed ? "flex-none" : "flex-1 min-h-0"} bg-white dark:bg-slate-900 rounded-xl border border-slate-150 dark:border-slate-850 overflow-hidden`}>
        <div className={`px-3 py-2 flex-shrink-0 ${collapsed ? "" : "border-b border-slate-150 dark:border-slate-850"}`}>
          {collapseToggle}
        </div>
        {!collapsed && (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-400 dark:text-slate-600 p-3">
            DOM inspector
          </div>
        )}
      </div>
    );
  }

  const { snapshot } = el;
  const breadcrumb = snapshot.ancestorChain.map((seg) => seg.tag);

  return (
    <div
      className={`flex flex-col ${collapsed ? "flex-none" : "flex-1 min-h-0"} bg-white dark:bg-slate-900 rounded-xl border border-slate-150 dark:border-slate-850 overflow-hidden`}
    >
      <div className={`px-3 py-2 flex-shrink-0 ${collapsed ? "" : "border-b border-slate-150 dark:border-slate-850"}`}>
        {collapseToggle}
      </div>
      {!collapsed && (
      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-[11px]">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Ancestor Path</div>
          <div className="font-mono text-slate-600 dark:text-slate-300 break-all">
            {breadcrumb.map((tag, i) => (
              <span key={i}>
                {i > 0 && <span className="text-slate-300 dark:text-slate-700"> › </span>}
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">DOM Depth</div>
            <div className="text-slate-700 dark:text-slate-200">{snapshot.domDepth}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Sibling Position</div>
            <div className="text-slate-700 dark:text-slate-200">
              {snapshot.siblingIndex + 1} of {snapshot.siblingCount}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Parent</div>
            <div className="text-slate-700 dark:text-slate-200 font-mono">{snapshot.parentTag ?? "—"}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Children</div>
            <div className="text-slate-700 dark:text-slate-200 font-mono truncate">
              {snapshot.childTags.length > 0 ? snapshot.childTags.join(", ") : "—"}
            </div>
          </div>
        </div>

        {snapshot.limitedContext && (
          <div className="px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300 text-[10px]">
            Limited context: {snapshot.limitedContext === "cross-origin-iframe" ? "inside a cross-origin iframe" : "possibly inside a closed shadow root"} —
            full support for this is planned for a later release.
          </div>
        )}

        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Outer HTML</div>
          <pre className="whitespace-pre-wrap break-all bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-lg p-2 font-mono text-[10px] text-slate-600 dark:text-slate-300 max-h-64 overflow-y-auto">
            {snapshot.outerHtml}
          </pre>
        </div>
      </div>
      )}
    </div>
  );
}
