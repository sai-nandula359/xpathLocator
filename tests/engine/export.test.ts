import { describe, expect, it } from "vitest";
import { exportCsv } from "@/export/csv";
import { exportJson } from "@/export/json";
import { exportTxt } from "@/export/txt";
import type { CaptureSession, CapturedElement, LocatorCandidate } from "@/types";

const SCORE = {
  uniqueness: 30,
  attributeStability: 25,
  domDependency: 15,
  readability: 9,
  length: 10,
  dynamicRisk: 10,
  total: 99,
};

function candidate(overrides: Partial<LocatorCandidate>): LocatorCandidate {
  return {
    id: "c1",
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
  const primary = candidate({});
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
      childTags: [],
      domDepth: 3,
      nearbyLabelText: null,
      ancestorChain: [],
      isSensitive: false,
      limitedContext: null,
      pageUrl: "https://example.com/login",
      pageTitle: "Login",
      viewportWidth: 1280,
      viewportHeight: 800,
    },
    candidates: [primary],
    primaryLocatorId: primary.id,
    capturedAt: "now",
    updatedAt: "now",
    version: 1,
    ...overrides,
  };
}

function makeSession(elements: CapturedElement[]): CaptureSession {
  return {
    id: "s1",
    name: "Test Session",
    createdAt: "now",
    updatedAt: "now",
    baseUrl: "https://example.com",
    currentUrl: "https://example.com/login",
    elements,
  };
}

describe("exportJson", () => {
  // Deliberately minimal — just enough to know which element a locator belongs to (name) and the
  // locator itself (type + value). No tag/page metadata, classification, score, or validation
  // detail; that fuller picture is what the TXT export is for.
  it("groups candidates by element name, with just type and value for each", () => {
    const session = makeSession([makeElement()]);
    const parsed = JSON.parse(exportJson(session));
    const el = parsed.elements[0];
    expect(el.name).toBe("Login Submit Button");
    expect(el.candidates[0]).toEqual({
      type: "xpath-attribute",
      value: "//button[@data-testid='login-button']",
    });
  });

  it("does not include tag/page metadata, classification, score, or validation detail", () => {
    const session = makeSession([makeElement()]);
    const json = exportJson(session);
    for (const field of ["tag", "page", "classification", "score", "status", "outerHtml", "attributeStability"]) {
      expect(json).not.toContain(field);
    }
  });

  it("sorts candidates by score before dropping the score field", () => {
    const weakCandidate = candidate({ id: "c-weak", value: "//div", score: { ...SCORE, total: 10 } });
    const strongCandidate = candidate({ id: "c-strong", score: SCORE }); // total: 99, from the SCORE fixture
    const el = makeElement({ candidates: [weakCandidate, strongCandidate] });
    const parsed = JSON.parse(exportJson(makeSession([el])));
    expect(parsed.elements[0].candidates[0].value).toBe("//button[@data-testid='login-button']");
  });
});

describe("exportCsv", () => {
  it("includes the doc's own suggested header columns", () => {
    const csv = exportCsv([makeElement()]);
    const [header] = csv.split("\r\n");
    expect(header).toBe(
      "Element Name,Tag,Text,Locator Type,Primary Locator,Secondary Locator,CSS,ID,Name,Role,Test ID,Uniqueness,Stability Score",
    );
  });

  it("puts the primary locator's value in the row, and marks it Unique", () => {
    const csv = exportCsv([makeElement()]);
    const [, row] = csv.split("\r\n");
    expect(row).toContain("//button[@data-testid='login-button']");
    expect(row).toContain("Unique");
  });

  it("escapes a value containing a comma", () => {
    const el = makeElement({ name: "Row, With Comma" });
    const csv = exportCsv([el]);
    expect(csv).toContain('"Row, With Comma"');
  });
});

describe("exportTxt", () => {
  it("lists every candidate under its element, sorted by score", () => {
    const txt = exportTxt([makeElement()]);
    expect(txt).toContain("Login Submit Button");
    expect(txt).toContain("[Primary]");
    expect(txt).toContain("//button[@data-testid='login-button']");
  });

  it("includes the viewport the element was captured at", () => {
    const txt = exportTxt([makeElement()]);
    expect(txt).toContain("Viewport: 1280×800");
  });
});
