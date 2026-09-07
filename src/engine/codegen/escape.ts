// Every generated locator string here already comes out of engine/xpath/util.ts's
// xpathLiteral() (prefers single quotes, so it essentially never contains a double quote) or
// engine/css.ts's own double-quote-escaping — but embedding *that* string inside a second,
// outer double-quoted string literal (Java/JS/TS/C#/Python all use `"..."` in the doc's own
// examples) still needs its own escaping for the rare case where one does slip through.
export function escapeDoubleQuoted(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Quotes a string for JS/TS the way the doc's own examples do: single quotes normally,
 * falling back to double quotes when the value itself contains a single quote (the common case
 * for our XPath/CSS values, e.g. //input[name='username']) — matching the doc's own
 * `page.locator("input[name='username']")` example, rather than always escaping. */
export function quoteJs(value: string): string {
  if (!value.includes("'")) return `'${value.replace(/\\/g, "\\\\")}'`;
  if (!value.includes('"')) return `"${value.replace(/\\/g, "\\\\")}"`;
  return `\`${value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${")}\``;
}

/** Same quoting preference as quoteJs (single quotes, falling back to double), which also
 * happens to be valid Python — but a value containing both quote characters (rare, but possible
 * in an XPath predicate combining attributes) needs Python's triple-quote escape hatch instead
 * of JS's template-literal one. */
export function quotePy(value: string): string {
  if (!value.includes("'")) return `'${value.replace(/\\/g, "\\\\")}'`;
  if (!value.includes('"')) return `"${value.replace(/\\/g, "\\\\")}"`;
  return `'''${value.replace(/\\/g, "\\\\").replace(/'''/g, "\\'\\'\\'")}'''`;
}
