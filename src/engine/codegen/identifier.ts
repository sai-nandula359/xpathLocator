// Turns an element's human-readable name (e.g. "Login Submit Button", from engine/namer.ts)
// into a valid identifier in whatever casing a target language expects. Every code generator
// uses these rather than deriving names on its own, so identifier style stays consistent.

const RESERVED_FALLBACK = "element";

function words(name: string): string[] {
  const cleaned = name
    .replace(/\(.*?\)/g, " ") // drop disambiguation suffixes like "(in loginForm)"
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim();
  const w = cleaned.split(/\s+/).filter(Boolean);
  return w.length > 0 ? w : [RESERVED_FALLBACK];
}

export function toCamelCase(name: string): string {
  const [first, ...rest] = words(name);
  return (
    first.toLowerCase() + rest.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("")
  );
}

export function toPascalCase(name: string): string {
  return words(name)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

export function toSnakeCase(name: string): string {
  return words(name)
    .map((w) => w.toLowerCase())
    .join("_");
}

export function toUpperSnakeCase(name: string): string {
  return words(name)
    .map((w) => w.toUpperCase())
    .join("_");
}
