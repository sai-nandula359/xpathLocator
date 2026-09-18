import { getCodeGenerator } from "@/engine/codegen/registry";
import { buildExcelSheets } from "@/export/excel";
import { exportCsv } from "@/export/csv";
import { exportJson } from "@/export/json";
import { exportMarkdown } from "@/export/markdown";
import { exportTxt } from "@/export/txt";
import type { CaptureSession } from "@/types";

type StructuredFormat = "json" | "txt" | "csv" | "markdown" | "excel";
// A code-generator id (e.g. "selenium-java", "playwright-ts" — see
// engine/codegen/frameworks.ts's FRAMEWORKS) is also a valid export format: bulk "export all/
// selected elements as a runnable framework file" reuses each CodeGenerator's own
// generateBlock(), the same method the Page Object dialog's per-element code already comes from —
// this file just needed to look it up by id and save it, no new codegen logic.
export type ExportFormat = StructuredFormat | string;
export type ExportScope = "all" | "selected";

const FORMAT_FILTERS: Record<Exclude<StructuredFormat, "excel">, FileDialogFilter> = {
  json: { name: "JSON", extensions: ["json"] },
  txt: { name: "Text", extensions: ["txt"] },
  csv: { name: "CSV", extensions: ["csv"] },
  markdown: { name: "Markdown", extensions: ["md"] },
};

const FORMAT_EXTENSION: Record<StructuredFormat, string> = {
  json: "json",
  txt: "txt",
  csv: "csv",
  markdown: "md",
  excel: "xlsx",
};

function isStructuredFormat(format: ExportFormat): format is StructuredFormat {
  return format in FORMAT_EXTENSION;
}

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

  if (!isStructuredFormat(format)) {
    const generator = getCodeGenerator(format);
    if (!generator) return { ok: false, canceled: false };
    return window.captureStudio.files.saveFile({
      defaultName: `${sanitizeFileName(session.name)}.${generator.fileExtension}`,
      filters: [{ name: generator.label, extensions: [generator.fileExtension] }],
      content: generator.generateBlock(elements),
    });
  }

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
