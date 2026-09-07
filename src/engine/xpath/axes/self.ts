// section 13 — self:: axis. Doc example: //button[@id='loginButton']/self::button
// Not a new *locating* mechanism on its own (an id already uniquely identifies the element) —
// it's a tag-confirmation refinement on top of the wildcard //*[@id=...] form from section
// 12.3, defensively guarding against an id being reused on an unexpected element type.

import { isDynamicValue } from "@/engine/dynamicAttributeDetector";
import { xpathLiteral } from "@/engine/xpath/util";
import type { RawCandidate } from "@/engine/types";
import type { ElementSnapshot } from "@/types";

export function generateSelfAxis(snapshot: ElementSnapshot): RawCandidate[] {
  const id = snapshot.attributes.id;
  if (!id) return [];

  return [
    {
      type: "xpath-axis",
      axis: "self",
      value: `//*[@id=${xpathLiteral(id)}]/self::${snapshot.tag}`,
      usesDynamicAttribute: isDynamicValue(id),
      attributeName: "id",
    },
  ];
}
