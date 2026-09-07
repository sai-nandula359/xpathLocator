import type { ElementSnapshot, LocatorType, StabilitySettings, XPathAxis } from "@/types";

/** What a generator module produces, before validation/scoring/classification are applied. */
export interface RawCandidate {
  type: LocatorType;
  value: string;
  usesDynamicAttribute: boolean;
  /** The attribute this candidate keys on (e.g. "id", "data-testid"), when applicable — lets
   * the scorer look up its stability tier directly instead of re-parsing the locator string. */
  attributeName?: string;
  /** Set only for type: "xpath-axis". */
  axis?: XPathAxis;
}

export type Generator = (snapshot: ElementSnapshot, settings: StabilitySettings) => RawCandidate[];
