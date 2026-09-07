import { describe, expect, it } from "vitest";
import { robotFrameworkGenerator } from "@/engine/codegen/robotFramework";
import { loginButtonElement, usernameInputElement } from "./fixtures";

describe("Robot Framework", () => {
  it("declares an id= variable in Robot's ${VAR}    strategy=value format", () => {
    // section 26's own example shape: ${LOGIN_BUTTON}    xpath=//button[@id='loginButton']
    expect(robotFrameworkGenerator.generateDeclaration(loginButtonElement())).toBe(
      `\${LOGIN_SUBMIT_BUTTON}    id=loginButton`,
    );
  });

  it("falls back to name= when there's no id", () => {
    expect(robotFrameworkGenerator.generateDeclaration(usernameInputElement())).toBe(
      `\${USERNAME_INPUT}    name=username`,
    );
  });

  it("wraps a block in a *** Variables *** table", () => {
    const block = robotFrameworkGenerator.generateBlock([loginButtonElement()]);
    expect(block).toBe(`*** Variables ***\n\${LOGIN_SUBMIT_BUTTON}    id=loginButton`);
  });
});
