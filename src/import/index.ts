// section 64 — Session Import. Opens a native file picker (JSON/CSV/Excel) and reconstructs a
// CaptureSession from whichever one the user picked — see json.ts/csv.ts/excel.ts for what each
// format can and can't recover, and common.ts for the shared placeholder-element reconstruction
// they all build on.

import { parseCsvSession } from "@/import/csv";
import { parseExcelSession } from "@/import/excel";
import { parseJsonSession } from "@/import/json";
import type { CaptureSession } from "@/types";

export interface ImportResult {
  ok: boolean;
  canceled?: boolean;
  session?: CaptureSession;
  error?: string;
}

const FILTERS: FileDialogFilter[] = [
  { name: "Session Export", extensions: ["json", "csv", "xlsx"] },
  { name: "JSON", extensions: ["json"] },
  { name: "CSV", extensions: ["csv"] },
  { name: "Excel Workbook", extensions: ["xlsx"] },
];

export async function importSession(): Promise<ImportResult> {
  const picked = await window.captureStudio.files.openSessionFile({ filters: FILTERS });
  if (!picked.ok) return { ok: false, canceled: picked.canceled, error: picked.error };

  try {
    if (picked.format === "excel") {
      if (!picked.rows) throw new Error("Excel import returned no rows.");
      return { ok: true, session: parseExcelSession(picked.rows) };
    }

    const content = picked.content ?? "";
    const isJson = (picked.filePath ?? "").toLowerCase().endsWith(".json");
    const session = isJson ? parseJsonSession(content) : parseCsvSession(content);
    return { ok: true, session };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't read that file as a session export." };
  }
}
