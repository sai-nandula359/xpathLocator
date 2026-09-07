import { exportCsv } from "@/export/csv";
import { exportJson } from "@/export/json";
import { exportTxt } from "@/export/txt";
import type { CaptureSession } from "@/types";

export type ExportFormat = "json" | "txt" | "csv";
export type ExportScope = "all" | "selected";

const FORMAT_FILTERS: Record<ExportFormat, FileDialogFilter> = {
  json: { name: "JSON", extensions: ["json"] },
  txt: { name: "Text", extensions: ["txt"] },
  csv: { name: "CSV", extensions: ["csv"] },
};

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "_").trim() || "session";
}

export async function exportSession(
  session: CaptureSession,
  format: ExportFormat,
  scope: ExportScope,
  selectedIds: Set<string>,
): Promise<SaveFileResult> {
  const elements = scope === "all" ? session.elements : session.elements.filter((el) => selectedIds.has(el.id));
  const scopedSession: CaptureSession = { ...session, elements };

  let content: string;
  if (format === "json") content = exportJson(scopedSession);
  else if (format === "csv") content = exportCsv(elements);
  else content = exportTxt(elements);

  return window.captureStudio.files.saveFile({
    defaultName: `${sanitizeFileName(session.name)}.${format}`,
    filters: [FORMAT_FILTERS[format]],
    content,
  });
}
