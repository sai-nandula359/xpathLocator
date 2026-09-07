import { describe, expect, it } from "vitest";
import { classifyCandidates, scoreAll, scoreCandidate } from "@/engine/scorer";
import type { LocatorCandidate, ValidationResult } from "@/types";

const ZERO_SCORE = {
  uniqueness: 0,
  attributeStability: 0,
  domDependency: 0,
  readability: 0,
  length: 0,
  dynamicRisk: 0,
  total: 0,
};

function candidate(overrides: Partial<LocatorCandidate>): LocatorCandidate {
  return {
    id: overrides.id ?? Math.random().toString(36),
    type: "xpath-attribute",
    value: "//button[@id='x']",
    usesDynamicAttribute: false,
    score: { ...ZERO_SCORE },
    classification: "fallback",
    ...overrides,
  };
}

function validation(matchCount: number, valid = true, visibleMatchCount = matchCount): ValidationResult {
  // Mirrors engine/validator.ts's toValidationResult() exactly — uniqueness is judged on the
  // raw DOM match count, not visibility (see that file for why).
  const unique = valid && matchCount === 1;
  return { valid, matchCount, visibleMatchCount, unique, executionTimeMs: 1, checkedAt: "now" };
}

describe("scoreCandidate — uniqueness component", () => {
  it("awards full marks for exactly one match", () => {
    const c = candidate({ type: "xpath-id", attributeName: "id" });
    expect(scoreCandidate(c, validation(1)).uniqueness).toBe(30);
  });

  it("awards zero for no matches", () => {
    const c = candidate({});
    expect(scoreCandidate(c, validation(0)).uniqueness).toBe(0);
  });

  it("penalizes non-unique matches proportionally, never dropping below 2", () => {
    const c = candidate({});
    const four = scoreCandidate(c, validation(4)).uniqueness;
    const fifty = scoreCandidate(c, validation(50)).uniqueness;
    expect(four).toBeLessThan(30);
    expect(four).toBeGreaterThan(fifty);
    expect(fifty).toBeGreaterThanOrEqual(2);
  });
});

describe("scoreCandidate — uniqueness is judged on raw DOM matches, not visibility", () => {
  // Real sites very commonly render hidden duplicates of the same widget (a mobile nav next to
  // a desktop one, an inactive tab panel) sharing the same id/data-testid — confirmed live on a
  // real site during manual testing: 4 DOM matches for the same id, only 1 actually visible. A
  // locator that resolves to those 4 elements is NOT safe to recommend just because 3 are
  // currently hidden: Playwright's strict mode throws ("resolved to 4 elements") regardless of
  // visibility, and Selenium's find_element silently grabs whichever one happens to be first.
  it("still penalizes a locator with hidden duplicates — visibility never masks a real DOM match count", () => {
    const c = candidate({});
    const hiddenDuplicates = validation(4, true, 1); // 4 in the DOM, only 1 visible
    expect(scoreCandidate(c, hiddenDuplicates).uniqueness).toBeLessThan(30);
    expect(hiddenDuplicates.unique).toBe(false);
  });

  it("penalizes a locator with multiple *visible* matches the same way", () => {
    const c = candidate({});
    const genuinelyAmbiguous = validation(4, true, 4);
    expect(scoreCandidate(c, genuinelyAmbiguous).uniqueness).toBeLessThan(30);
    expect(genuinelyAmbiguous.unique).toBe(false);
  });

  it("still scores a single DOM match as unique even if it isn't currently visible (e.g. mid-animation)", () => {
    const c = candidate({});
    const transientlyHidden = validation(1, true, 0); // 1 DOM match, 0 visible right now
    expect(scoreCandidate(c, transientlyHidden).uniqueness).toBe(30);
    expect(transientlyHidden.unique).toBe(true);
  });
});

describe("scoreCandidate — attribute stability tiers", () => {
  it("ranks a data-testid attribute above a plain id, and id above class", () => {
    const testId = scoreCandidate(
      candidate({ type: "xpath-attribute", attributeName: "data-testid" }),
      validation(1),
    ).attributeStability;
    const id = scoreCandidate(candidate({ type: "xpath-id", attributeName: "id" }), validation(1))
      .attributeStability;
    const cls = scoreCandidate(candidate({ type: "xpath-class", attributeName: "class" }), validation(1))
      .attributeStability;
    const absolute = scoreCandidate(candidate({ type: "xpath-absolute" }), validation(1)).attributeStability;

    expect(testId).toBeGreaterThan(id);
    expect(id).toBeGreaterThan(cls);
    expect(cls).toBeGreaterThan(absolute);
  });

  it("a data-testid candidate never scores lower than a plain id candidate, even when its own value string is longer (regression guard)", () => {
    // Whole-candidate total, not just the attributeStability component in isolation — this is
    // what actually broke once already: adding a new fixed structural tier nudged MAX_TIER up by
    // one, which quietly narrowed the attributeStability gap between data-testid and id just
    // enough that a longer-but-more-stable data-testid value scored strictly *below* a shorter
    // id purely on the length component. The two are a genuine tie at this exact pair of value
    // strings (classifyCandidates' worked-example test below relies on its stable sort keeping
    // the earlier-listed data-testid candidate on a tie, not on this total being strictly
    // higher) — so the invariant that must never regress is "never worse," and it's worth
    // guarding directly since any future structural tier addition can trip it again the same way.
    const testId = candidate({
      type: "xpath-attribute",
      attributeName: "data-testid",
      value: "//button[@data-testid='login-button']",
    });
    const id = candidate({ type: "xpath-id", attributeName: "id", value: "//button[@id='loginButton']" });
    const testIdTotal = scoreCandidate(testId, validation(1)).total;
    const idTotal = scoreCandidate(id, validation(1)).total;
    expect(testIdTotal).toBeGreaterThanOrEqual(idTotal);
  });
});

describe("scoreCandidate — dynamic risk", () => {
  it("penalizes a candidate that uses a dynamic attribute", () => {
    const stable = scoreCandidate(candidate({ usesDynamicAttribute: false }), validation(1)).dynamicRisk;
    const dynamic = scoreCandidate(candidate({ usesDynamicAttribute: true }), validation(1)).dynamicRisk;
    expect(stable).toBeGreaterThan(dynamic);
  });
});

describe("classifyCandidates", () => {
  it("matches the doc's own worked example: data-testid primary, id secondary, text fallback (section 20)", () => {
    const testId = candidate({
      id: "c-testid",
      type: "xpath-attribute",
      attributeName: "data-testid",
      value: "//button[@data-testid='login-button']",
    });
    const id = candidate({
      id: "c-id",
      type: "xpath-id",
      attributeName: "id",
      value: "//button[@id='loginButton']",
    });
    const text = candidate({
      id: "c-text",
      type: "xpath-text",
      value: "//button[normalize-space()='Login']",
    });

    testId.validation = validation(1);
    id.validation = validation(1);
    text.validation = validation(1);

    const all = [testId, id, text];
    scoreAll(all);
    classifyCandidates(all);

    expect(testId.classification).toBe("primary");
    expect(id.classification).toBe("secondary");
    expect(text.classification).toBe("fallback");
  });

  it("still recommends a primary when nothing validated as unique, rather than leaving none", () => {
    const onlyOption = candidate({ id: "c1" });
    onlyOption.validation = validation(4);
    scoreAll([onlyOption]);
    classifyCandidates([onlyOption]);
    expect(onlyOption.classification).toBe("primary");
    expect(onlyOption.validation!.unique).toBe(false);
  });

  it("caps Secondary at two candidates, pushing the rest to Fallback", () => {
    const items = ["a", "b", "c", "d"].map((id, i) =>
      candidate({ id, type: "xpath-attribute", attributeName: "name", value: `//div[@name='${id}${i}']` }),
    );
    for (const c of items) c.validation = validation(1);
    scoreAll(items);
    classifyCandidates(items);

    const counts = items.reduce<Record<string, number>>((acc, c) => {
      acc[c.classification] = (acc[c.classification] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts.primary).toBe(1);
    expect(counts.secondary).toBe(2);
    expect(counts.fallback).toBe(1);
  });

  it("never lets a unique axis candidate outrank a unique id/data-testid candidate", () => {
    const testId = candidate({
      id: "c-testid",
      type: "xpath-attribute",
      attributeName: "data-testid",
      value: "//input[@data-testid='username']",
    });
    const axisParent = candidate({
      id: "c-axis",
      type: "xpath-axis",
      axis: "parent",
      value: "//label[normalize-space()='Username']/parent::div//input",
    });
    testId.validation = validation(1);
    axisParent.validation = validation(1);

    const all = [testId, axisParent];
    scoreAll(all);
    classifyCandidates(all);

    expect(testId.classification).toBe("primary");
    expect(axisParent.classification).toBe("fallback");
    expect(testId.score.total).toBeGreaterThan(axisParent.score.total);
  });
});
