import { describe, expect, it } from "vitest";
import { FRAMEWORKS } from "@/engine/codegen/frameworks";
import { CODE_GENERATORS, getCodeGenerator } from "@/engine/codegen/registry";
import { loginButtonElement } from "./fixtures";

describe("codegen registry", () => {
  it("has exactly one generator per FRAMEWORKS entry, same ids", () => {
    const frameworkIds = FRAMEWORKS.map((f) => f.id).sort();
    const generatorIds = CODE_GENERATORS.map((g) => g.id).sort();
    expect(generatorIds).toEqual(frameworkIds);
  });

  it("looks up a generator by id and produces non-empty output for every framework", () => {
    const el = loginButtonElement();
    for (const framework of FRAMEWORKS) {
      const generator = getCodeGenerator(framework.id);
      expect(generator, `missing generator for ${framework.id}`).not.toBeNull();
      expect(generator!.generateDeclaration(el).length).toBeGreaterThan(0);
    }
  });

  it("returns null for an unknown id", () => {
    expect(getCodeGenerator("not-a-real-framework")).toBeNull();
  });
});
