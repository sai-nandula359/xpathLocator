import { describe, expect, it } from "vitest";
import { generateSelfAxis } from "@/engine/xpath/axes/self";
import { loginButtonSnapshot, makeSnapshot } from "../fixtures";

describe("generateSelfAxis", () => {
  it("matches the doc's own example: //*[@id='loginButton']/self::button", () => {
    const [candidate] = generateSelfAxis(loginButtonSnapshot());
    expect(candidate.value).toBe("//*[@id='loginButton']/self::button");
    expect(candidate.axis).toBe("self");
  });

  it("produces nothing without an id", () => {
    expect(generateSelfAxis(makeSnapshot())).toEqual([]);
  });
});
