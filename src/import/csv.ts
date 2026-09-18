// Imports a session previously written by export/csv.ts. CSV is the richest text import path —
// unlike JSON, the row shape (COLUMNS in export/csv.ts) actually carries Tag/Text plus several
// named locator columns (CSS/ID/Name/Role/Test ID) alongside Primary/Secondary, so more than one
// candidate per element usually survives the round trip.

import { parseCsv } from "@/import/csvParse";
import { buildImportedElement, buildStubSnapshot, type ImportedCandidateInput } from "@/import/common";
import { nextId } from "@/engine/xpath/util";
import type { CaptureSession } from "@/types";

// Mirrors export/csv.ts's own COLUMNS list/order exactly.
const COLUMN_INDEX = {
  name: 0,
  tag: 1,
  text: 2,
  primaryValue: 4,
  secondaryValue: 5,
  css: 6,
  id: 7,
  nameAttr: 8,
  role: 9,
  testId: 10,
} as const;

function candidateInputsFor(row: string[]): ImportedCandidateInput[] {
  const inputs: ImportedCandidateInput[] = [];
  if (row[COLUMN_INDEX.primaryValue]) {
    inputs.push({ value: row[COLUMN_INDEX.primaryValue], classification: "primary" });
  }
  if (row[COLUMN_INDEX.secondaryValue]) {
    inputs.push({ value: row[COLUMN_INDEX.secondaryValue], classification: "secondary" });
  }
  if (row[COLUMN_INDEX.css]) inputs.push({ value: row[COLUMN_INDEX.css] });
  if (row[COLUMN_INDEX.id]) inputs.push({ value: row[COLUMN_INDEX.id], attributeName: "id" });
  if (row[COLUMN_INDEX.nameAttr]) inputs.push({ value: row[COLUMN_INDEX.nameAttr], attributeName: "name" });
  if (row[COLUMN_INDEX.role]) inputs.push({ value: row[COLUMN_INDEX.role], attributeName: "role" });
  if (row[COLUMN_INDEX.testId]) inputs.push({ value: row[COLUMN_INDEX.testId], attributeName: "data-testid" });
  return inputs;
}

export function parseCsvSession(raw: string): CaptureSession {
  const rows = parseCsv(raw);
  if (rows.length === 0) throw new Error("Empty CSV file.");
  const [, ...dataRows] = rows; // first row is the header

  const elements = dataRows.map((row, i) => {
    const name = row[COLUMN_INDEX.name]?.trim() || `Imported Element ${i + 1}`;
    const snapshot = buildStubSnapshot({ tag: row[COLUMN_INDEX.tag], text: row[COLUMN_INDEX.text] });
    return buildImportedElement(name, snapshot, candidateInputsFor(row));
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
