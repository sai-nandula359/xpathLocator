// Maps each FRAMEWORKS id (frameworks.ts) to its CodeGenerator — the single place the "Copy as
// Code" UI action and any bulk code export look up a generator by id, rather than each importing
// all nine generator modules individually.

import { cypressGenerator } from "@/engine/codegen/cypress";
import { playwrightJavaGenerator } from "@/engine/codegen/playwrightJava";
import { playwrightJsGenerator } from "@/engine/codegen/playwrightJs";
import { playwrightPythonGenerator } from "@/engine/codegen/playwrightPython";
import { playwrightTsGenerator } from "@/engine/codegen/playwrightTs";
import { robotFrameworkGenerator } from "@/engine/codegen/robotFramework";
import { seleniumCsharpGenerator } from "@/engine/codegen/seleniumCsharp";
import { seleniumJavaGenerator } from "@/engine/codegen/seleniumJava";
import { seleniumPythonGenerator } from "@/engine/codegen/seleniumPython";
import type { CodeGenerator } from "@/engine/codegen/types";

export const CODE_GENERATORS: readonly CodeGenerator[] = [
  seleniumJavaGenerator,
  seleniumPythonGenerator,
  seleniumCsharpGenerator,
  playwrightTsGenerator,
  playwrightJsGenerator,
  playwrightPythonGenerator,
  playwrightJavaGenerator,
  cypressGenerator,
  robotFrameworkGenerator,
];

const BY_ID: Record<string, CodeGenerator> = Object.fromEntries(CODE_GENERATORS.map((g) => [g.id, g]));

export function getCodeGenerator(id: string): CodeGenerator | null {
  return BY_ID[id] ?? null;
}
