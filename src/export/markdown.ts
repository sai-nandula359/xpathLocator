// section 43 — Markdown export. Carries the same scope as the TXT export (name/tag/page/
// viewport + every candidate's classification/type/score/status/value) since Markdown is the
// other "full readable record" format the doc lists, just laid out as tables instead of an
// indented list — renders cleanly in GitHub, most editors, and static-site docs.

import type { CapturedElement, LocatorCandidate } from "@/types";

function candidateStatus(c: LocatorCandidate): string {
  if (!c.validation) return "unvalidated";
  return c.validation.unique ? "unique" : `matches=${c.validation.matchCount}`;
}

function classificationLabel(c: string): string {
  return c.charAt(0).toUpperCase() + c.slice(1);
}

function escapeCell(value: string): string {
  // Backslash must be escaped *first* — escaping "|" alone would turn a value already
  // containing "\|" into "\\|", which a markdown table parser reads as one literal backslash
  // followed by an *unescaped* pipe (the two backslashes pair off and cancel out), breaking out
  // of the table cell instead of staying inside it.
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function exportMarkdown(elements: CapturedElement[]): string {
  const blocks = elements.map((el) => {
    const sorted = [...el.candidates].sort((a, b) => b.score.total - a.score.total);
    const lines = [
      `## ${el.name}`,
      "",
      `- **Tag:** \`${el.snapshot.tag}\``,
      `- **Page:** ${el.snapshot.pageUrl}`,
      `- **Viewport:** ${el.snapshot.viewportWidth}×${el.snapshot.viewportHeight}`,
      "",
      "| Classification | Type | Score | Status | Value |",
      "| --- | --- | --- | --- | --- |",
      ...sorted.map(
        (c) =>
          `| ${classificationLabel(c.classification)} | ${c.type} | ${c.score.total}/100 | ${candidateStatus(c)} | \`${escapeCell(c.value)}\` |`,
      ),
    ];
    return lines.join("\n");
  });
  return blocks.join("\n\n");
}
