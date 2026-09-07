// section 44 — JSON Export. Just the locator details, grouped by element: each element's name
// (so you know which locator belongs to which captured element) plus its candidates' type and
// value — no tag/page metadata, classification, score, or validation detail. TXT (export/txt.ts)
// is where that fuller picture belongs; JSON here is deliberately the minimal, locator-only form.

import type { CaptureSession } from "@/types";

export function exportJson(session: CaptureSession): string {
  const elements = session.elements.map((el) => ({
    name: el.name,
    candidates: [...el.candidates]
      .sort((a, b) => b.score.total - a.score.total)
      .map((c) => ({ type: c.type, value: c.value })),
  }));
  return JSON.stringify({ session: session.name, elements }, null, 2);
}
