// Shared helpers for the XPath generator modules.

import { isDynamicAttributeName, isDynamicValue } from "@/engine/dynamicAttributeDetector";
import { isTestIdAttribute } from "@/engine/stabilityConfig";
import type { StabilitySettings } from "@/types";

/**
 * Renders a string as an XPath string literal. Plain values just get single-quoted; a value
 * containing a single quote falls back to double quotes, and a value containing *both* quote
 * characters (which no quoting style alone can express) is built with concat(), the standard
 * XPath 1.0 workaround.
 */
export function xpathLiteral(value: string): string {
  if (!value.includes("'")) return `'${value}'`;
  if (!value.includes('"')) return `"${value}"`;
  const parts = value.split("'").map((part) => `'${part}'`);
  return `concat(${parts.join(", \"'\", ")})`;
}

export interface PredicateSource {
  tag: string;
  attributes: Record<string, string>;
  text?: string;
}

export interface BestPredicate {
  /** A ready-to-use bracket predicate body, e.g. "@id='x'" or "contains(@class, 'y')". */
  predicate: string;
  usesDynamicAttribute: boolean;
  attributeName?: string;
}

const NOTABLE_PREDICATE_ATTRIBUTES = ["aria-label", "role", "placeholder", "title", "href", "alt", "type"];

/**
 * Picks the single best `@attr='value'`-style predicate for an element — used by the axis
 * generators (parent/ancestor/descendant/etc.) to build the anchor and target sides of an axis
 * expression, so every axis module doesn't have to re-implement "what's this element's most
 * identifying attribute" from scratch. Priority mirrors stabilityConfig's ordering: id > test-id
 * > name > notable attributes > a stable class token > visible text as a last resort.
 */
export function bestPredicateFor(
  source: PredicateSource,
  settings: StabilitySettings,
): BestPredicate | null {
  const { attributes } = source;

  if (attributes.id) {
    return { predicate: `@id=${xpathLiteral(attributes.id)}`, usesDynamicAttribute: isDynamicValue(attributes.id), attributeName: "id" };
  }
  for (const attr of settings.testIdAttributes) {
    if (attributes[attr]) {
      return {
        predicate: `@${attr}=${xpathLiteral(attributes[attr])}`,
        usesDynamicAttribute: isDynamicAttributeName(attr) || isDynamicValue(attributes[attr]),
        attributeName: attr,
      };
    }
  }
  if (attributes.name) {
    return { predicate: `@name=${xpathLiteral(attributes.name)}`, usesDynamicAttribute: isDynamicValue(attributes.name), attributeName: "name" };
  }
  for (const attr of NOTABLE_PREDICATE_ATTRIBUTES) {
    if (attributes[attr]) {
      return {
        predicate: `@${attr}=${xpathLiteral(attributes[attr])}`,
        usesDynamicAttribute: isDynamicValue(attributes[attr]),
        attributeName: attr,
      };
    }
  }
  if (attributes.class) {
    const tokens = attributes.class.split(/\s+/).filter(Boolean);
    if (tokens.length > 0) {
      const stableToken = tokens.find((t) => !isDynamicValue(t)) ?? tokens[0];
      return {
        predicate: `contains(@class, ${xpathLiteral(stableToken)})`,
        usesDynamicAttribute: isDynamicValue(stableToken),
        attributeName: "class",
      };
    }
  }
  const text = source.text?.trim();
  if (text) {
    return { predicate: `normalize-space()=${xpathLiteral(text)}`, usesDynamicAttribute: isDynamicValue(text) };
  }
  return null;
}

let counter = 0;

/** Stable-enough id generator for candidates/elements — collision-free within a session. */
export function nextId(prefix: string): string {
  counter += 1;
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${counter}`;
}
