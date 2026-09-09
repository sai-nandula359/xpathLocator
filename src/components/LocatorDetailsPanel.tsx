import { ChevronDown, ChevronRight, Copy, RefreshCw, Star, Wand2, Wrench } from "lucide-react";
import { useState } from "react";
import type { CaptureSessionApi } from "@/hooks/useCaptureSession";
import { validateCandidate } from "@/session/liveValidate";
import { repairElement } from "@/session/repairLocator";
import { classifyCandidates, scoreCandidate } from "@/engine/scorer";
import { FRAMEWORKS } from "@/engine/codegen/frameworks";
import { getCodeGenerator } from "@/engine/codegen/registry";
import CustomLocatorBuilderModal from "@/components/CustomLocatorBuilderModal";
import type { LocatorCandidate, ValidationResult } from "@/types";

interface LocatorDetailsPanelProps {
  api: CaptureSessionApi;
  webviewRef: React.RefObject<ElectronWebviewElement | null>;
}

const CLASSIFICATION_STYLE: Record<string, string> = {
  primary: "bg-blue-600 text-white",
  secondary: "bg-emerald-500 text-white",
  fallback: "bg-slate-400 dark:bg-slate-600 text-white",
};

// Uniqueness is judged on the raw DOM match count, not visibility (see ValidationResult.unique
// for why) — when visibleMatchCount differs from matchCount, both numbers are still shown so
// it's clear *why* a locator with several DOM matches is Non-Unique even if only one is
// currently rendered on screen.
function formatMatchBadge(v: ValidationResult): string {
  const status = v.unique ? "Unique" : "Non-Unique";
  if (v.visibleMatchCount === v.matchCount) {
    return `${v.matchCount} match${v.matchCount === 1 ? "" : "es"} · ${status}`;
  }
  return `${v.visibleMatchCount} visible match${v.visibleMatchCount === 1 ? "" : "es"} (${v.matchCount} in DOM) · ${status}`;
}

export default function LocatorDetailsPanel({ api, webviewRef }: LocatorDetailsPanelProps) {
  const [retesting, setRetesting] = useState<string | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  // Which framework's code to show — a per-view UI choice, not a persisted setting (this project
  // deliberately has no settings/preferences store).
  const [framework, setFramework] = useState(FRAMEWORKS[0].id);
  const el = api.selectedElement;

  const collapseToggle = (
    <button
      onClick={() => setCollapsed((v) => !v)}
      className="flex items-center gap-1.5 min-w-0 text-left"
      title={collapsed ? "Expand" : "Collapse"}
      data-testid="locator-details-collapse-toggle"
    >
      {collapsed ? (
        <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
      ) : (
        <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
      )}
      <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 truncate">
        Locator Details
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
            Select a captured element to see its locators.
          </div>
        )}
      </div>
    );
  }

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    api.addToast("Copied to clipboard.", "success");
  };

  const makePrimary = (candidateId: string) => {
    api.setPrimaryLocator(el.id, candidateId);
  };

  const retest = async (candidate: LocatorCandidate) => {
    const webview = webviewRef.current;
    if (!webview) return;
    setRetesting(candidate.id);
    try {
      const validation = await validateCandidate(webview, candidate, el.snapshot.frameSrc);
      const updated: LocatorCandidate = { ...candidate, validation, score: scoreCandidate(candidate, validation) };
      const nextCandidates = el.candidates.map((c) => (c.id === candidate.id ? updated : c));
      api.updateElement(el.id, { ...el, candidates: nextCandidates });
    } finally {
      setRetesting(null);
    }
  };

  // section 34 — Locator Repair: re-validates every stored candidate against the live DOM and
  // promotes whichever one is now the strongest unique replacement, for when the current Primary
  // has gone stale (e.g. the id it depended on changed after a deploy).
  const repair = async () => {
    const webview = webviewRef.current;
    if (!webview) return;
    setRepairing(true);
    try {
      const outcome = await repairElement(webview, el);
      api.updateElement(el.id, {
        ...el,
        candidates: outcome.candidates,
        primaryLocatorId: outcome.newPrimary?.id ?? el.primaryLocatorId,
      });
      if (outcome.repaired) {
        api.addToast(`Primary locator was broken — repaired to "${outcome.newPrimary!.value}".`, "success");
      } else if (outcome.unrepairable) {
        api.addToast(
          "No valid replacement found among existing candidates — try re-capturing this element.",
          "error",
        );
      } else {
        api.addToast("Primary locator is already valid — no repair needed.", "info");
      }
    } finally {
      setRepairing(false);
    }
  };

  // A manually-built candidate competes for Primary/Secondary the same way an automatically
  // generated one does — classifyCandidates re-derives every candidate's classification from
  // scratch, so this can genuinely take over the slot if it scores well and validated unique,
  // not just get appended as an inert extra row.
  const saveCustomCandidate = (candidate: LocatorCandidate) => {
    const nextCandidates = [...el.candidates, candidate];
    classifyCandidates(nextCandidates);
    const primary = nextCandidates.find((c) => c.classification === "primary");
    api.updateElement(el.id, { ...el, candidates: nextCandidates, primaryLocatorId: primary?.id ?? el.primaryLocatorId });
    setBuilderOpen(false);
    api.addToast("Custom locator added.", "success");
  };

  const sorted = [...el.candidates].sort((a, b) => b.score.total - a.score.total);
  const generatedCode = getCodeGenerator(framework)?.generateDeclaration(el) ?? "";

  return (
    <div
      className={`flex flex-col ${collapsed ? "flex-none" : "flex-1 min-h-0"} bg-white dark:bg-slate-900 rounded-xl border border-slate-150 dark:border-slate-850 overflow-hidden`}
    >
      <div className={`px-3 py-2 flex-shrink-0 ${collapsed ? "" : "border-b border-slate-150 dark:border-slate-850"}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {collapseToggle}
            {!collapsed && (
              <>
                <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{el.name}</div>
                <div className="text-[10px] font-mono text-slate-400 truncate">{el.snapshot.pageUrl}</div>
              </>
            )}
          </div>
          {!collapsed && (
            <div className="flex-shrink-0 flex items-center gap-1.5">
              <button
                onClick={() => void repair()}
                disabled={repairing}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 disabled:opacity-50"
                title="Re-validate every candidate and promote a working replacement if the current Primary is broken"
              >
                <Wand2 className={`w-3 h-3 ${repairing ? "animate-pulse" : ""}`} />
                Repair
              </button>
              <button
                onClick={() => setBuilderOpen(true)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
                title="Manually pick attributes to build a custom locator"
              >
                <Wrench className="w-3 h-3" />
                Build Custom
              </button>
            </div>
          )}
        </div>
      </div>

      {builderOpen && (
        <CustomLocatorBuilderModal
          element={el}
          webviewRef={webviewRef}
          onClose={() => setBuilderOpen(false)}
          onSave={saveCustomCandidate}
        />
      )}

      {!collapsed && (
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <section>
          <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Attributes</h3>
          <div className="rounded-lg border border-slate-150 dark:border-slate-800 overflow-hidden">
            {Object.entries(el.snapshot.attributes).length === 0 && (
              <div className="px-2 py-1.5 text-[11px] text-slate-400">No attributes.</div>
            )}
            {Object.entries(el.snapshot.attributes).map(([k, v]) => (
              <div
                key={k}
                className="flex text-[11px] px-2 py-1 border-b last:border-b-0 border-slate-100 dark:border-slate-850"
              >
                <span className="w-28 flex-shrink-0 font-mono text-slate-500 dark:text-slate-400 truncate">{k}</span>
                <span className="flex-1 min-w-0 font-mono text-slate-700 dark:text-slate-200 truncate">{v}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Generated Code</h3>
            <select
              value={framework}
              onChange={(e) => setFramework(e.target.value)}
              data-testid="codegen-framework-select"
              className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 focus:outline-none"
            >
              {FRAMEWORKS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-lg border border-slate-150 dark:border-slate-800 p-2 flex items-start gap-2">
            <code
              data-testid="codegen-output"
              className="flex-1 min-w-0 text-[11px] font-mono text-slate-700 dark:text-slate-200 break-all whitespace-pre-wrap"
            >
              {generatedCode}
            </code>
            <button
              onClick={() => void copy(generatedCode)}
              className="flex-shrink-0 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
              title="Copy generated code"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        </section>

        <section>
          <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">
            Locator Candidates ({sorted.length})
          </h3>
          <div className="space-y-2">
            {sorted.map((c) => (
              <div
                key={c.id}
                className={`rounded-lg border p-2 ${
                  c.id === el.primaryLocatorId
                    ? "border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20"
                    : "border-slate-150 dark:border-slate-800"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${CLASSIFICATION_STYLE[c.classification]}`}
                  >
                    {c.classification}
                  </span>
                  <span className="text-[9px] font-mono uppercase text-slate-400">{c.type}</span>
                  {c.usesDynamicAttribute && (
                    <span className="text-[9px] font-bold text-amber-500" title="Uses an attribute that looks dynamically generated">
                      dynamic risk
                    </span>
                  )}
                  <span className="ml-auto text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    {c.score.total}/100
                  </span>
                </div>
                <code className="block text-[11px] font-mono text-slate-700 dark:text-slate-200 break-all">
                  {c.value}
                </code>
                <div className="mt-1.5 flex items-center gap-2">
                  {c.validation ? (
                    <span
                      className={`text-[10px] font-semibold ${
                        c.validation.unique
                          ? "text-emerald-600 dark:text-emerald-400"
                          : c.validation.valid
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {c.validation.valid ? formatMatchBadge(c.validation) : `Invalid: ${c.validation.error ?? "error"}`}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Not yet validated</span>
                  )}
                  <button
                    onClick={() => void retest(c)}
                    disabled={retesting === c.id}
                    className="ml-auto p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
                    title="Test locator against the live DOM"
                  >
                    <RefreshCw className={`w-3 h-3 ${retesting === c.id ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    onClick={() => void copy(c.value)}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
                    title="Copy"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => makePrimary(c.id)}
                    disabled={c.id === el.primaryLocatorId}
                    className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 ${
                      c.id === el.primaryLocatorId ? "text-blue-500" : "text-slate-400"
                    }`}
                    title="Set as primary"
                  >
                    <Star className="w-3 h-3" fill={c.id === el.primaryLocatorId ? "currentColor" : "none"} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      )}
    </div>
  );
}
