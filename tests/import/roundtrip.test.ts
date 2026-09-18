import { describe, expect, it } from "vitest";
import { exportCsv } from "@/export/csv";
import { exportJson } from "@/export/json";
import { parseCsvSession } from "@/import/csv";
import { parseExcelSession } from "@/import/excel";
import { parseJsonSession } from "@/import/json";
import type { CaptureSession, CapturedElement, LocatorCandidate } from "@/types";

const SCORE = { uniqueness: 30, attributeStability: 25, domDependency: 15, readability: 9, length: 10, dynamicRisk: 10, total: 99 };

function candidate(overrides: Partial<LocatorCandidate>): LocatorCandidate {
  return {
    id: overrides.id ?? "c1",
    type: "xpath-attribute",
    value: "//button[@data-testid='login-button']",
    usesDynamicAttribute: false,
    attributeName: "data-testid",
    score: SCORE,
    classification: "primary",
    validation: { valid: true, matchCount: 1, visibleMatchCount: 1, unique: true, executionTimeMs: 1, checkedAt: "now" },
    ...overrides,
  };
}

function makeElement(overrides: Partial<CapturedElement> = {}): CapturedElement {
  const testId = candidate({ id: "c-testid", classification: "primary" });
  const id = candidate({
    id: "c-id",
    type: "xpath-id",
    attributeName: "id",
    value: "//button[@id='loginButton']",
    score: { ...SCORE, total: 80 },
    classification: "secondary",
  });
  return {
    id: "el1",
    name: "Login Submit Button",
    snapshot: {
      tag: "button",
      text: "Login",
      innerText: "Login",
      outerHtml: "<button>Login</button>",
      attributes: { "data-testid": "login-button", id: "loginButton" },
      classList: ["btn"],
      parentTag: "div",
      parentAttributes: null,
      siblingIndex: 0,
      siblingCount: 1,
      tagSiblingCount: 1,
      childTags: [],
      domDepth: 3,
      nearbyLabelText: null,
      ancestorChain: [],
      isSensitive: false,
      limitedContext: null,
      pageUrl: "https://example.com/login",
      pageTitle: "Login",
      labelAnchor: null,
      landmarkAncestor: null,
      siblingAnchors: { previous: null, next: null },
      stateAnchor: null,
      frameSrc: null,
      viewportWidth: 1280,
      viewportHeight: 800,
    },
    candidates: [testId, id],
    primaryLocatorId: testId.id,
    capturedAt: "now",
    updatedAt: "now",
    version: 1,
    ...overrides,
  };
}

function makeSession(elements: CapturedElement[]): CaptureSession {
  return {
    id: "s1",
    name: "Login Flow",
    createdAt: "now",
    updatedAt: "now",
    baseUrl: "https://example.com/login",
    currentUrl: "https://example.com/login",
    elements,
  };
}

describe("parseJsonSession — round trip through export/json.ts", () => {
  it("recovers the session name, element name, and best-scored candidate as primary", () => {
    const session = makeSession([makeElement()]);
    const parsed = parseJsonSession(exportJson(session));

    expect(parsed.name).toBe("Login Flow");
    expect(parsed.elements).toHaveLength(1);
    const el = parsed.elements[0];
    expect(el.name).toBe("Login Submit Button");
    expect(el.candidates.length).toBeGreaterThan(0);
    const primary = el.candidates.find((c) => c.id === el.primaryLocatorId);
    // export/json.ts sorts by score descending, so the testid candidate (score 99) comes first.
    expect(primary?.value).toBe("//button[@data-testid='login-button']");
    // Every reconstructed candidate starts unvalidated — the app's own Repair flow re-checks it.
    expect(el.candidates.every((c) => c.validation === undefined)).toBe(true);
  });

  it("gives every element a fresh, unique id even across two imports of the same export", () => {
    const raw = exportJson(makeSession([makeElement()]));
    const a = parseJsonSession(raw);
    const b = parseJsonSession(raw);
    expect(a.elements[0].id).not.toBe(b.elements[0].id);
    expect(a.id).not.toBe(b.id);
  });

  it("throws a clear error for a file that isn't a recognized session export", () => {
    expect(() => parseJsonSession(JSON.stringify({ foo: "bar" }))).toThrow(/elements/);
  });
});

describe("parseCsvSession — round trip through export/csv.ts", () => {
  it("recovers name, tag, text, and multiple named locator candidates", () => {
    const session = makeSession([makeElement()]);
    const parsed = parseCsvSession(exportCsv(session.elements));

    expect(parsed.elements).toHaveLength(1);
    const el = parsed.elements[0];
    expect(el.name).toBe("Login Submit Button");
    expect(el.snapshot.tag).toBe("button");
    expect(el.snapshot.text).toBe("Login");

    const values = el.candidates.map((c) => c.value);
    expect(values).toContain("//button[@data-testid='login-button']"); // Primary Locator column
    expect(values).toContain("//button[@id='loginButton']"); // Secondary Locator column AND ID column

    const primary = el.candidates.find((c) => c.id === el.primaryLocatorId);
    expect(primary?.classification).toBe("primary");
  });

  it("de-duplicates a value that appears in more than one CSV column (e.g. Secondary and ID both point at the id candidate)", () => {
    const session = makeSession([makeElement()]);
    const parsed = parseCsvSession(exportCsv(session.elements));
    const el = parsed.elements[0];
    const idValueCount = el.candidates.filter((c) => c.value === "//button[@id='loginButton']").length;
    expect(idValueCount).toBe(1);
  });
});

describe("parseExcelSession — reads the Elements sheet's own row shape", () => {
  it("recovers name, tag, text, and the primary locator from row data", () => {
    const rows: (string | number)[][] = [
      ["Element Name", "Tag", "Text", "Primary Type", "Primary Locator", "Score", "Uniqueness", "Viewport"],
      ["Login Submit Button", "button", "Login", "xpath-attribute", "//button[@data-testid='login-button']", 99, "Unique", "1280×800"],
    ];
    const parsed = parseExcelSession(rows);
    expect(parsed.elements).toHaveLength(1);
    const el = parsed.elements[0];
    expect(el.name).toBe("Login Submit Button");
    expect(el.snapshot.tag).toBe("button");
    const primary = el.candidates.find((c) => c.id === el.primaryLocatorId);
    expect(primary?.value).toBe("//button[@data-testid='login-button']");
  });

  it("throws for an empty sheet", () => {
    expect(() => parseExcelSession([])).toThrow();
  });
});
