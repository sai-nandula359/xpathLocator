// section 23 — Playwright (JavaScript). Doc examples:
// page.getByRole('button', { name: 'Login' })
// page.getByTestId('login-button')
// page.getByPlaceholder('Username')
// page.locator("input[name='username']")

import { playwrightBlock, playwrightDeclaration, playwrightPageObjectJs } from "@/engine/codegen/playwrightJsLike";
import type { CodeGenerator } from "@/engine/codegen/types";

export const playwrightJsGenerator: CodeGenerator = {
  id: "playwright-js",
  label: "Playwright (JavaScript)",
  fileExtension: "js",
  generateDeclaration: playwrightDeclaration,
  generateBlock: playwrightBlock,
  generatePageObject: playwrightPageObjectJs,
};
