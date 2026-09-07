// section 12.1 — Absolute XPath. Generated primarily for reference; the scorer marks it low
// reliability regardless of validation outcome (engine rule 1: never *recommend* it over a
// reliable relative one).

import type { RawCandidate } from "@/engine/types";
import type { ElementSnapshot } from "@/types";

export function generateAbsolute(snapshot: ElementSnapshot): RawCandidate[] {
  if (snapshot.ancestorChain.length === 0) return [];

  const segments = snapshot.ancestorChain.map((seg) =>
    seg.tag === "html" ? "html" : `${seg.tag}[${seg.index}]`,
  );

  return [
    {
      type: "xpath-absolute",
      value: `/${segments.join("/")}`,
      usesDynamicAttribute: false,
    },
  ];
}
