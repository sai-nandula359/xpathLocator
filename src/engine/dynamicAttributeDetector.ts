// section 16 — heuristics that flag likely-dynamic attribute values/names, so the scorer can
// penalize locators built on them. These are heuristics, not proofs: a value that looks stable
// can still change on rebuild, and a value that looks "generated" can still be a deliberately
// stable test id (e.g. a real UUID chosen on purpose) — configurable via Settings, per section 49.

interface DynamicValuePattern {
  name: string;
  test: (value: string) => boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// 10 (seconds) or 13 (ms) digit unix timestamp.
const TIMESTAMP_RE = /^\d{10}(\d{3})?$/;
// A trailing run of 3+ digits, or digits after a separator — react-id="42", input-4821, id_88213.
const NUMERIC_SUFFIX_RE = /[-_:]\d{3,}$|\d{4,}$/;
// Long hex-looking string — content hash, build hash, etc.
const HASH_LIKE_RE = /^[0-9a-f]{16,}$/i;
// Common framework-generated id/class prefixes: React (":r..."), MUI, Radix, styled-components/
// emotion ("css-...", "sc-..."), Vue scoped ids, Angular content/host markers.
const FRAMEWORK_GENERATED_RE =
  /^(:r[0-9a-z]+:|mui-\d+|radix-.*|css-[a-z0-9]+|sc-[a-zA-Z0-9]+|v-[a-f0-9]{8}|ember\d+|react-select-\d+)$/;
// A long alphanumeric token mixing letters and digits with no readable word boundaries —
// generic "looks generated" catch-all, checked last and treated as the weakest signal.
const LONG_RANDOM_TOKEN_RE = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9]{12,}$/;
// Framework-generated tokens are often *embedded* inside a longer, human-chosen id rather than
// being the whole value on their own — e.g. React's useId() produces a bare ":r4:", but a
// component commonly prefixes/suffixes it into something like "tabs-:r4:-modal-tabpanel-0"
// (confirmed live on a real production site). FRAMEWORK_GENERATED_RE above only catches the bare
// form (anchored start-to-end); this catches the same tokens wherever they appear in the string.
const EMBEDDED_FRAMEWORK_TOKEN_RE = /:r[0-9a-z]+:|\bradix-[a-z0-9-]+\b|\bmui-\d+\b|\bv-[a-f0-9]{8}\b/;

export const DEFAULT_DYNAMIC_VALUE_PATTERNS: DynamicValuePattern[] = [
  { name: "uuid", test: (v) => UUID_RE.test(v) },
  { name: "timestamp", test: (v) => TIMESTAMP_RE.test(v) },
  { name: "numeric-suffix", test: (v) => NUMERIC_SUFFIX_RE.test(v) },
  { name: "hash-like", test: (v) => HASH_LIKE_RE.test(v) },
  { name: "framework-generated", test: (v) => FRAMEWORK_GENERATED_RE.test(v) },
  { name: "embedded-framework-token", test: (v) => EMBEDDED_FRAMEWORK_TOKEN_RE.test(v) },
  { name: "long-random-token", test: (v) => LONG_RANDOM_TOKEN_RE.test(v) },
];

// Attribute *names* that are themselves framework churn markers, regardless of value —
// Vue's data-v-xxxxxxxx scoping attribute, Angular's _ngcontent-*/_nghost-* markers.
const DYNAMIC_ATTRIBUTE_NAME_RE = /^(data-v-[0-9a-f]{6,}|_ngcontent-.*|_nghost-.*)$/i;

export function isDynamicAttributeName(name: string): boolean {
  return DYNAMIC_ATTRIBUTE_NAME_RE.test(name);
}

export function isDynamicValue(
  value: string,
  patterns: DynamicValuePattern[] = DEFAULT_DYNAMIC_VALUE_PATTERNS,
): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return patterns.some((p) => p.test(trimmed));
}

/** A single CSS class token that looks generated (styled-components/emotion/CSS-modules hash). */
export function isDynamicClassToken(token: string): boolean {
  return (
    /^(css|sc|jsx|styles?)-[a-zA-Z0-9]{5,}$/.test(token) ||
    /^[a-zA-Z0-9_-]*_[a-z0-9]{5,}$/.test(token) // CSS-module suffix, e.g. button_a1b2c3
  );
}

/** True if this attribute (name+value pair) looks unstable and should lose stability score. */
export function isDynamicAttribute(name: string, value: string): boolean {
  if (isDynamicAttributeName(name)) return true;
  if (name === "class") {
    return value.split(/\s+/).filter(Boolean).some(isDynamicClassToken);
  }
  return isDynamicValue(value);
}

const MIN_STABLE_PREFIX_LENGTH = 3;

/**
 * A value flagged dynamic by isDynamicValue() is often only *partly* generated — e.g. React's
 * useId() produces a bare ":r4:", but a component commonly embeds it into something like
 * "tabs-:r4:-modal-tabpanel-0" (confirmed live on a real production site), where "tabs-" is a
 * perfectly stable, human-chosen literal. This finds that leading stable chunk — the part of the
 * value before wherever a numeric-suffix or embedded-framework-token pattern kicks in — so a
 * starts-with() candidate can anchor on it instead of discarding the whole attribute. Returns
 * null when there's nothing worth anchoring on: the value is dynamic end-to-end (a bare UUID,
 * timestamp, hash, or framework token with no literal prefix at all), or what's left after
 * stripping the dynamic part is too short to mean anything on its own.
 */
export function extractStablePrefix(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // These patterns only ever match the *entire* value (they're anchored start-to-end, or are
  // inherently whole-value signals like a hash/UUID) — there's no partial literal chunk to salvage.
  if (
    UUID_RE.test(trimmed) ||
    TIMESTAMP_RE.test(trimmed) ||
    HASH_LIKE_RE.test(trimmed) ||
    LONG_RANDOM_TOKEN_RE.test(trimmed) ||
    FRAMEWORK_GENERATED_RE.test(trimmed)
  ) {
    return null;
  }

  const matches = [NUMERIC_SUFFIX_RE.exec(trimmed), EMBEDDED_FRAMEWORK_TOKEN_RE.exec(trimmed)].filter(
    (m): m is RegExpExecArray => m !== null,
  );
  if (matches.length === 0) return null;

  const earliest = matches.reduce((a, b) => (b.index < a.index ? b : a));
  const prefix = trimmed.slice(0, earliest.index).replace(/[-_:]+$/, "");
  return prefix.length >= MIN_STABLE_PREFIX_LENGTH ? prefix : null;
}
