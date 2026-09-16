import { buildExcelSheets } from "@/export/excel";
import { exportCsv } from "@/export/csv";
import { exportJson } from "@/export/json";
import { exportMarkdown } from "@/export/markdown";
import { exportTxt } from "@/export/txt";
import type { CaptureSession } from "@/types";

export type ExportFormat = "json" | "txt" | "csv" | "markdown" | "excel";
export type ExportScope = "all" | "selected";

const FORMAT_FILTERS: Record<Exclude<ExportFormat, "excel">, FileDialogFilter> = {
  json: { name: "JSON", extensions: ["json"] },
  txt: { name: "Text", extensions: ["txt"] },
  csv: { name: "CSV", extensions: ["csv"] },
  markdown: { name: "Markdown", extensions: ["md"] },
};

const FORMAT_EXTENSION: Record<ExportFormat, string> = {
  json: "json",
  txt: "txt",
  csv: "csv",
  markdown: "md",
  excel: "xlsx",
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
  const defaultName = `${sanitizeFileName(session.name)}.${FORMAT_EXTENSION[format]}`;

  // xlsx is a binary zip archive — built in the main process (which has the library and fs
  // access the sandboxed renderer doesn't), so this sends plain sheet data instead of content.
  if (format === "excel") {
    return window.captureStudio.files.saveExcel({
      defaultName,
      sheets: buildExcelSheets(scopedSession, elements),
    });
  }

  let content: string;
  if (format === "json") content = exportJson(scopedSession);
  else if (format === "csv") content = exportCsv(elements);
  else if (format === "markdown") content = exportMarkdown(elements);
  else content = exportTxt(elements);

  return window.captureStudio.files.saveFile({
    defaultName,
    filters: [FORMAT_FILTERS[format]],
    content,
  });
}
