// section 43 — plain-text export: a human-readable listing, one block per element.

import type { CapturedElement } from "@/types";

function classificationLabel(c: string): string {
  return c.charAt(0).toUpperCase() + c.slice(1);
}

export function exportTxt(elements: CapturedElement[]): string {
  const blocks = elements.map((el) => {
    const lines = [
      `${el.name}`,
      `  Tag: ${el.snapshot.tag}`,
      `  Page: ${el.snapshot.pageUrl}`,
      `  Viewport: ${el.snapshot.viewportWidth}×${el.snapshot.viewportHeight}`,
      "",
    ];
    const sorted = [...el.candidates].sort((a, b) => b.score.total - a.score.total);
    for (const c of sorted) {
      const badge = c.validation
        ? c.validation.unique
          ? "unique"
          : `matches=${c.validation.matchCount}`
        : "unvalidated";
      lines.push(`  [${classificationLabel(c.classification)}] (${c.type}, score ${c.score.total}/100, ${badge})`);
      lines.push(`    ${c.value}`);
    }
    return lines.join("\n");
  });
  return blocks.join("\n\n");
}
