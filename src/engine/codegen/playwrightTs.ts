// section 28 — Playwright TypeScript. Doc example:
// const loginButton = page.getByRole('button', { name: 'Login' })

import { playwrightBlock, playwrightDeclaration } from "@/engine/codegen/playwrightJsLike";
import type { CodeGenerator } from "@/engine/codegen/types";

export const playwrightTsGenerator: CodeGenerator = {
  id: "playwright-ts",
  label: "Playwright (TypeScript)",
  fileExtension: "ts",
  generateDeclaration: playwrightDeclaration,
  generateBlock: playwrightBlock,
};
