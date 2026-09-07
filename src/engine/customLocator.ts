// Manual locator disambiguation — the interactive counterpart to the fully-automatic pipeline in
// generate.ts/captureElement.ts. Inspired by a reference tool's "Resolve Duplicate Match" dialog
// (checkboxes per attribute, live match-count feedback, a last-resort position() option): when a
// user doesn't like what the engine picked, this lets them compose a //tag[@a='x' and @b='y']
// predicate from the captured element's own attributes by hand, with the same live-validation
// and indexed-disambiguation machinery the automatic path already uses (see
// components/CustomLocatorBuilderModal.tsx for the interactive side of this).

import { xpathLiteral } from "@/engine/xpath/util";
import type { ElementAttributes } from "@/types";

/**
 * Builds a `//tag[@a='x' and @b='y']` predicate from the checked attribute names, in the order
 * given. Returns null for an empty selection — there's no such thing as a useful empty predicate,
 * and callers should treat that as "nothing to preview yet," not as a valid locator.
 */
export function buildCustomXPath(tag: string, attributes: ElementAttributes, checkedNames: string[]): string | null {
  if (checkedNames.length === 0) return null;
  const parts = checkedNames
    .filter((name) => attributes[name] !== undefined)
    .map((name) => `@${name}=${xpathLiteral(attributes[name])}`);
  if (parts.length === 0) return null;
  return `//${tag}[${parts.join(" and ")}]`;
}
