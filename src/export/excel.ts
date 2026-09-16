// section 46 — Excel Export. Builds the doc's own suggested sheets (Elements, XPath,
// Frameworks, Metadata) as plain data — an xlsx file is a binary zip archive, so the actual
// workbook gets built in the main process (see electron/main.cjs's export:saveExcel), which has
// the library (ExcelJS) and filesystem access the sandboxed renderer doesn't.

import { FRAMEWORKS } from "@/engine/codegen/frameworks";
import { getCodeGenerator } from "@/engine/codegen/registry";
import type { CaptureSession, CapturedElement } from "@/types";

function primaryOf(el: CapturedElement) {
  return el.candidates.find((c) => c.id === el.primaryLocatorId) ?? el.candidates[0] ?? null;
}

function elementsSheet(elements: CapturedElement[]): ExcelSheet {
  return {
    name: "Elements",
    columns: ["Element Name", "Tag", "Text", "Primary Type", "Primary Locator", "Score", "Uniqueness", "Viewport"],
    rows: elements.map((el) => {
      const primary = primaryOf(el);
      return [
        el.name,
        el.snapshot.tag,
        el.snapshot.text || el.snapshot.innerText,
        primary?.type ?? "",
        primary?.value ?? "",
        primary?.score.total ?? 0,
        primary?.validation?.unique ? "Unique" : "Non-Unique",
        `${el.snapshot.viewportWidth}×${el.snapshot.viewportHeight}`,
      ];
    }),
  };
}

function xpathSheet(elements: CapturedElement[]): ExcelSheet {
  const rows: (string | number)[][] = [];
  for (const el of elements) {
    for (const c of el.candidates.filter((c) => c.type.startsWith("xpath"))) {
      rows.push([
        el.name,
        c.type,
        c.value,
        c.score.total,
        c.validation ? (c.validation.unique ? "Unique" : `Matches=${c.validation.matchCount}`) : "Unvalidated",
      ]);
    }
  }
  return { name: "XPath", columns: ["Element Name", "Type", "Value", "Score", "Status"], rows };
}

function frameworksSheet(elements: CapturedElement[]): ExcelSheet {
  return {
    name: "Frameworks",
    columns: ["Element Name", ...FRAMEWORKS.map((f) => f.label)],
    rows: elements.map((el) => [
      el.name,
      ...FRAMEWORKS.map((f) => getCodeGenerator(f.id)?.generateDeclaration(el) ?? ""),
    ]),
  };
}

function metadataSheet(session: CaptureSession): ExcelSheet {
  return {
    name: "Metadata",
    columns: ["Field", "Value"],
    rows: [
      ["Session Name", session.name],
      ["Session ID", session.id],
      ["Created At", session.createdAt],
      ["Updated At", session.updatedAt],
      ["Base URL", session.baseUrl],
      ["Current URL", session.currentUrl],
      ["Element Count", session.elements.length],
      ["Exported At", new Date().toISOString()],
    ],
  };
}

export function buildExcelSheets(session: CaptureSession, elements: CapturedElement[]): ExcelSheet[] {
  return [elementsSheet(elements), xpathSheet(elements), frameworksSheet(elements), metadataSheet(session)];
}
