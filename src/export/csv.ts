// section 45 — CSV Export, using the doc's own suggested column list.

import { isTestIdAttribute } from "@/engine/stabilityConfig";
import type { CapturedElement, LocatorCandidate } from "@/types";

const COLUMNS = [
  "Element Name",
  "Tag",
  "Text",
  "Locator Type",
  "Primary Locator",
  "Secondary Locator",
  "CSS",
  "ID",
  "Name",
  "Role",
  "Test ID",
  "Uniqueness",
  "Stability Score",
];

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function findByAttribute(candidates: LocatorCandidate[], attr: string): LocatorCandidate | undefined {
  return candidates.find((c) => c.attributeName === attr);
}

function findTestId(candidates: LocatorCandidate[]): LocatorCandidate | undefined {
  return candidates.find((c) => c.attributeName && isTestIdAttribute(c.attributeName));
}

function rowFor(el: CapturedElement): string[] {
  const primary = el.candidates.find((c) => c.id === el.primaryLocatorId) ?? el.candidates[0];
  const secondary = el.candidates.find((c) => c.classification === "secondary");
  const css = el.candidates.find((c) => c.type === "css");
  const id = findByAttribute(el.candidates, "id");
  const name = findByAttribute(el.candidates, "name");
  const role = findByAttribute(el.candidates, "role");
  const testId = findTestId(el.candidates);

  return [
    el.name,
    el.snapshot.tag,
    el.snapshot.text || el.snapshot.innerText,
    primary?.type ?? "",
    primary?.value ?? "",
    secondary?.value ?? "",
    css?.value ?? "",
    id?.value ?? "",
    name?.value ?? "",
    role?.value ?? "",
    testId?.value ?? "",
    primary?.validation?.unique ? "Unique" : "Non-Unique",
    String(primary?.score.total ?? 0),
  ];
}

export function exportCsv(elements: CapturedElement[]): string {
  const lines = [COLUMNS.join(",")];
  for (const el of elements) {
    lines.push(rowFor(el).map(csvEscape).join(","));
  }
  return lines.join("\r\n");
}
