import { Code2, Crosshair, Download, Moon, Save, Sun, Target } from "lucide-react";
import type { CaptureSessionApi } from "@/hooks/useCaptureSession";
import type { WebviewCaptureApi } from "@/hooks/useWebviewCapture";
import SessionDropdown from "@/components/SessionDropdown";

interface HeaderProps {
  api: CaptureSessionApi;
  webviewApi: WebviewCaptureApi;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onNewSession: () => void;
  onOpenSession: (id: string) => void;
  onImportSession: () => void;
  onOpenExport: () => void;
  onOpenPageObject: () => void;
}

export default function Header({
  api,
  webviewApi,
  isDarkMode,
  onToggleDarkMode,
  onNewSession,
  onOpenSession,
  onImportSession,
  onOpenExport,
  onOpenPageObject,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b backdrop-blur-md bg-white/90 dark:bg-slate-950/80 border-slate-150 dark:border-slate-850 transition-colors duration-200">
      <div className="px-4 md:px-6">
        <div className="flex items-center justify-between h-16 gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 flex-shrink-0">
              <Crosshair className="w-5 h-5" />
            </div>
            <div className="min-w-0 hidden sm:block">
              <h1 className="font-sans font-black tracking-tight text-[#0f172a] dark:text-white uppercase text-sm truncate">
                Smart Locator Capture Studio
              </h1>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 font-mono tracking-wider">
                  {api.session.name.toUpperCase()}
                </span>
                <span className="w-1 h-1 bg-slate-400 dark:bg-slate-600 rounded-full" />
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 font-mono">
                  {api.session.elements.length} CAPTURED
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 flex-shrink-0">
            <SessionDropdown
              api={api}
              onNewSession={onNewSession}
              onOpenSession={onOpenSession}
              onImportSession={onImportSession}
            />
            <button
              onClick={() => void api.saveSession()}
              className="p-2 border border-gray-150 dark:border-slate-850 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-gray-500 dark:text-gray-400"
              title="Save Session (Ctrl+S)"
            >
              <Save className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenExport}
              className="p-2 border border-gray-150 dark:border-slate-850 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-gray-500 dark:text-gray-400"
              title="Export (Ctrl+E)"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenPageObject}
              className="p-2 border border-gray-150 dark:border-slate-850 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-gray-500 dark:text-gray-400"
              title="Generate Page Object"
            >
              <Code2 className="w-4 h-4" />
            </button>

            <div
              className={`hidden md:flex items-center px-3 py-1 rounded-full text-[10px] uppercase font-extrabold tracking-wide ${
                webviewApi.captureModeEnabled
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400"
                  : "bg-slate-500/10 border border-slate-500/20 text-slate-500 dark:text-slate-400"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full mr-2 ${
                  webviewApi.captureModeEnabled ? "bg-emerald-400 glowing-indicator" : "bg-slate-400"
                }`}
              />
              {webviewApi.captureModeEnabled ? "Capture Mode On" : "Capture Mode Off"}
            </div>

            <button
              onClick={webviewApi.toggleCaptureMode}
              className={`p-2 rounded-lg transition-colors border ${
                webviewApi.captureModeEnabled
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "border-gray-150 dark:border-slate-850 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
              }`}
              title="Toggle capture mode (Ctrl+Shift+C)"
            >
              <Target className="w-4 h-4" />
            </button>

            <button
              onClick={onToggleDarkMode}
              className="p-2 border border-gray-150 dark:border-slate-850 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-gray-500 dark:text-gray-400"
              title="Toggle theme"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
