// Imports a session previously written by export/excel.ts. Reads the "Elements" sheet's own rows
// (electron/main.cjs's import:openSessionFile hands them over already parsed via ExcelJS, header
// included) — the workbook's other sheets (XPath/Frameworks/Metadata) are export-only views built
// from the same elements, so nothing is lost by not reading them back.

import { buildImportedElement, buildStubSnapshot } from "@/import/common";
import { nextId } from "@/engine/xpath/util";
import type { CaptureSession } from "@/types";

// Mirrors export/excel.ts's elementsSheet() column order exactly.
const COLUMN_INDEX = { name: 0, tag: 1, text: 2, primaryValue: 4 } as const;

export function parseExcelSession(rows: (string | number)[][]): CaptureSession {
  if (rows.length === 0) throw new Error("Elements sheet is empty.");
  const [, ...dataRows] = rows; // first row is the header

  const elements = dataRows.map((row, i) => {
    const name = String(row[COLUMN_INDEX.name] ?? "").trim() || `Imported Element ${i + 1}`;
    const snapshot = buildStubSnapshot({
      tag: String(row[COLUMN_INDEX.tag] ?? ""),
      text: String(row[COLUMN_INDEX.text] ?? ""),
    });
    const primaryValue = String(row[COLUMN_INDEX.primaryValue] ?? "");
    return buildImportedElement(
      name,
      snapshot,
      primaryValue ? [{ value: primaryValue, classification: "primary" as const }] : [],
    );
  });

  const now = new Date().toISOString();
  return {
    id: nextId("session"),
    name: "Imported Session",
    createdAt: now,
    updatedAt: now,
    baseUrl: "",
    currentUrl: "",
    elements,
  };
}
