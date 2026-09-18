import { describe, expect, it } from "vitest";
import { generatePosition } from "@/engine/xpath/position";
import { makeSnapshot } from "./fixtures";

function rowSnapshot(index: number, tagSiblingCount: number) {
  return makeSnapshot({
    tag: "div",
    tagSiblingCount,
    ancestorChain: [
      { tag: "html", index: 1 },
      { tag: "body", index: 1 },
      { tag: "div", index },
    ],
  });
}

describe("generatePosition", () => {
  it("emits position()=N for a middle same-tag sibling, without last()", () => {
    const candidates = generatePosition(rowSnapshot(2, 3));
    expect(candidates).toEqual([{ type: "xpath-position", value: "//div[position()=2]", usesDynamicAttribute: false }]);
  });

  it("also emits last() when the element is the final same-tag sibling", () => {
    const candidates = generatePosition(rowSnapshot(3, 3));
    expect(candidates.map((c) => c.value)).toEqual(["//div[position()=3]", "//div[last()]"]);
  });

  it("produces nothing when it's the only element of its tag under the parent", () => {
    expect(generatePosition(rowSnapshot(1, 1))).toEqual([]);
  });

  it("produces nothing when ancestorChain is empty", () => {
    expect(generatePosition(makeSnapshot({ tag: "div", tagSiblingCount: 3, ancestorChain: [] }))).toEqual([]);
  });

  it("produces nothing when ancestorChain's last segment doesn't match the element's own tag (mismatched fixture data)", () => {
    const snapshot = makeSnapshot({
      tag: "input",
      tagSiblingCount: 3,
      ancestorChain: [{ tag: "html", index: 1 }, { tag: "body", index: 1 }, { tag: "div", index: 1 }],
    });
    expect(generatePosition(snapshot)).toEqual([]);
  });
});
