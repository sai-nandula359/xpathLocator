import { describe, expect, it } from "vitest";
import { parseCsv } from "@/import/csvParse";

describe("parseCsv", () => {
  it("parses a simple unquoted CSV", () => {
    expect(parseCsv("a,b,c\r\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("un-escapes a quoted field containing a comma", () => {
    expect(parseCsv('a,"b,c",d')).toEqual([["a", "b,c", "d"]]);
  });

  it("un-escapes doubled quotes inside a quoted field", () => {
    expect(parseCsv('a,"she said ""hi""",c')).toEqual([["a", 'she said "hi"', "c"]]);
  });

  it("un-escapes a quoted field containing an embedded newline", () => {
    expect(parseCsv('a,"line1\nline2",c')).toEqual([["a", "line1\nline2", "c"]]);
  });

  it("handles a file with no trailing newline", () => {
    expect(parseCsv("a,b")).toEqual([["a", "b"]]);
  });
});
