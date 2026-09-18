import { afterEach, describe, expect, it, vi } from "vitest";
import { seleniumJavaGenerator } from "@/engine/codegen/seleniumJava";
import { exportCsv } from "@/export/csv";
import { buildExcelSheets } from "@/export/excel";
import { exportSession } from "@/export";
import { exportJson } from "@/export/json";
import { exportMarkdown } from "@/export/markdown";
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

describe("exportMarkdown", () => {
  it("renders a heading and a table row per element, same scope as TXT", () => {
    const md = exportMarkdown([makeElement()]);
    expect(md).toContain("## Login Submit Button");
    expect(md).toContain("- **Tag:** `button`");
    expect(md).toContain("- **Viewport:** 1280×800");
    expect(md).toContain("| Classification | Type | Score | Status | Value |");
    expect(md).toContain("| Primary | xpath-attribute | 99/100 | unique | `//button[@data-testid='login-button']` |");
  });

  it("escapes a pipe character in a locator value so it doesn't break the table", () => {
    const el = makeElement({
      candidates: [candidate({ value: "//div[@aria-label='A|B']" })],
    });
    const md = exportMarkdown([el]);
    expect(md).toContain("A\\|B");
  });

  // Regression for a real CodeQL finding ("Incomplete string escaping or encoding"): escaping
  // only "|" without first escaping a literal backslash means a value already containing "\|"
  // becomes "\\|" — read by a markdown table parser as one literal backslash followed by an
  // *unescaped* pipe (the two backslashes pair off and cancel out), breaking out of the cell.
  it("escapes a literal backslash before escaping pipes, so a value containing both parses correctly", () => {
    const el = makeElement({
      candidates: [candidate({ value: "A\\|B" })], // one literal backslash, then a pipe
    });
    const md = exportMarkdown([el]);
    // One source backslash -> "\\" (escaped) plus the pipe's own "\|" = three backslash
    // characters before the pipe, an odd count, so it actually escapes the pipe rather than the
    // backslashes pairing off and leaving it as a live table-cell separator.
    expect(md).toContain("A" + "\\".repeat(3) + "|B");
  });
});

describe("buildExcelSheets", () => {
  it("builds the doc's own suggested sheets: Elements, XPath, Frameworks, Metadata", () => {
    const el = makeElement();
    const sheets = buildExcelSheets(makeSession([el]), [el]);
    expect(sheets.map((s) => s.name)).toEqual(["Elements", "XPath", "Frameworks", "Metadata"]);
  });

  it("Elements sheet has one row per element with the primary locator", () => {
    const el = makeElement();
    const sheets = buildExcelSheets(makeSession([el]), [el]);
    const elementsSheet = sheets.find((s) => s.name === "Elements")!;
    expect(elementsSheet.rows).toHaveLength(1);
    expect(elementsSheet.rows[0]).toContain("//button[@data-testid='login-button']");
    expect(elementsSheet.rows[0]).toContain("Unique");
  });

  it("XPath sheet only includes xpath-typed candidates, not css", () => {
    const el = makeElement({
      candidates: [
        candidate({ id: "x1", type: "xpath-id", value: "//button[@id='loginButton']" }),
        candidate({ id: "c1", type: "css", value: "#loginButton" }),
      ],
    });
    const sheets = buildExcelSheets(makeSession([el]), [el]);
    const xpathSheet = sheets.find((s) => s.name === "XPath")!;
    expect(xpathSheet.rows).toHaveLength(1);
    expect(xpathSheet.rows[0]).toContain("//button[@id='loginButton']");
  });

  it("Frameworks sheet has one column per supported framework, generating real code for each", () => {
    const el = makeElement();
    const sheets = buildExcelSheets(makeSession([el]), [el]);
    const frameworksSheet = sheets.find((s) => s.name === "Frameworks")!;
    expect(frameworksSheet.columns).toContain("Selenium (Java)");
    expect(frameworksSheet.columns).toContain("Playwright (TypeScript)");
    expect(frameworksSheet.rows[0].some((cell) => String(cell).includes("login-button"))).toBe(true);
  });

  it("Metadata sheet carries session-level fields", () => {
    const el = makeElement();
    const session = makeSession([el]);
    const sheets = buildExcelSheets(session, [el]);
    const metadataSheet = sheets.find((s) => s.name === "Metadata")!;
    expect(metadataSheet.rows).toContainEqual(["Session Name", "Test Session"]);
    expect(metadataSheet.rows).toContainEqual(["Element Count", 1]);
  });
});

// A code-generator id (e.g. "selenium-java") is also a valid ExportFormat — exportSession routes
// it through the same generateBlock() the Page Object dialog already uses for per-element code,
// rather than through the json/txt/csv/markdown/excel branches. window.captureStudio is stubbed
// here the same way it would be provided by electron/preload.cjs in the real app.
describe("exportSession — code-format routing (section 21/47's bulk code export)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves a code generator's generateBlock output, with that generator's own file extension", async () => {
    const saveFile = vi.fn().mockResolvedValue({ ok: true, filePath: "LoginPage.java" });
    vi.stubGlobal("window", { captureStudio: { files: { saveFile } } });

    const el = makeElement();
    await exportSession(makeSession([el]), "selenium-java", "all", new Set());

    expect(saveFile).toHaveBeenCalledTimes(1);
    const args = saveFile.mock.calls[0][0];
    expect(args.defaultName).toBe("Test Session.java");
    expect(args.content).toBe(seleniumJavaGenerator.generateBlock([el]));
  });

  it("still routes json/csv/markdown/txt/excel through their own structured export, not code generation", async () => {
    const saveFile = vi.fn().mockResolvedValue({ ok: true, filePath: "x.json" });
    vi.stubGlobal("window", { captureStudio: { files: { saveFile } } });

    await exportSession(makeSession([makeElement()]), "json", "all", new Set());

    expect(saveFile).toHaveBeenCalledTimes(1);
    expect(saveFile.mock.calls[0][0].content).toContain('"session": "Test Session"');
  });

  it("returns a non-canceled failure for an unrecognized format, rather than throwing", async () => {
    vi.stubGlobal("window", { captureStudio: { files: { saveFile: vi.fn() } } });
    const result = await exportSession(makeSession([makeElement()]), "not-a-real-format", "all", new Set());
    expect(result).toEqual({ ok: false, canceled: false });
  });
});
