import type { CapturedElement } from "@/types";

export interface CodeGenerator {
  id: string;
  label: string;
  /** File extension (no dot) used when exporting a generated block to a file. */
  fileExtension: string;
  /** A single ready-to-paste locator statement for one element. */
  generateDeclaration(element: CapturedElement): string;
  /** A full snippet covering multiple elements, e.g. for bulk "Generate Code for Selected". */
  generateBlock(elements: CapturedElement[]): string;
  /** section 48 — a full Page Object class wrapping every given element's locator as a member,
   * in whatever shape is idiomatic for this framework/language (a constructor-injected driver/
   * page reference, getters, etc.). */
  generatePageObject(className: string, elements: CapturedElement[]): string;
}
