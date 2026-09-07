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
}
