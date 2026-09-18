// Imports a session previously written by export/json.ts. That format is deliberately minimal
// (session name + each element's name and candidates' type/value only — see json.ts's own
// comment) so this is the lossiest of the three import paths: no tag/text/page info survives,
// only a best-guess tag extracted from the first candidate's own XPath text.

import { buildImportedElement, buildStubSnapshot, guessTagFromXPath } from "@/import/common";
import { nextId } from "@/engine/xpath/util";
import type { CaptureSession } from "@/types";

interface ExportedJsonElement {
  name?: string;
  candidates?: { type?: string; value?: string }[];
}

interface ExportedJson {
  session?: string;
  elements?: ExportedJsonElement[];
}

export function parseJsonSession(raw: string): CaptureSession {
  const parsed = JSON.parse(raw) as ExportedJson;
  if (!Array.isArray(parsed.elements)) {
    throw new Error("Not a recognized session export: missing an \"elements\" array.");
  }

  const elements = parsed.elements.map((el, i) => {
    const values = (el.candidates ?? []).map((c) => c.value).filter((v): v is string => !!v);
    const name = el.name?.trim() || `Imported Element ${i + 1}`;
    const snapshot = buildStubSnapshot({ tag: guessTagFromXPath(values[0]) });
    return buildImportedElement(
      name,
      snapshot,
      // export/json.ts sorts candidates by score descending before writing them out, so the
      // first surviving value is the best available stand-in for the former primary.
      values.map((value, idx) => ({ value, classification: idx === 0 ? "primary" : "fallback" })),
    );
  });

  const now = new Date().toISOString();
  return {
    id: nextId("session"),
    name: parsed.session?.trim() || "Imported Session",
    createdAt: now,
    updatedAt: now,
    baseUrl: "",
    currentUrl: "",
    elements,
  };
}
