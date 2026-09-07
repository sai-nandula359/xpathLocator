// Single source of truth for the 9 supported framework/language targets (doc section 3/47) —
// both the header's framework selector and the code-gen UI import this, rather than each
// keeping their own copy of the list.

export interface FrameworkOption {
  id: string;
  label: string;
}

export const FRAMEWORKS: FrameworkOption[] = [
  { id: "selenium-java", label: "Selenium (Java)" },
  { id: "selenium-python", label: "Selenium (Python)" },
  { id: "selenium-csharp", label: "Selenium (C#)" },
  { id: "playwright-ts", label: "Playwright (TypeScript)" },
  { id: "playwright-js", label: "Playwright (JavaScript)" },
  { id: "playwright-python", label: "Playwright (Python)" },
  { id: "playwright-java", label: "Playwright (Java)" },
  { id: "cypress", label: "Cypress" },
  { id: "robot-framework", label: "Robot Framework" },
];
