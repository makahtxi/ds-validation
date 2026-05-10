import { describe, it, expect } from "vitest";
import {
  computeCheckScore,
  computeComponentScore,
  computeTotalScore,
  determineStatus,
} from "./score";
import type { CheckResult } from "../types/checks";

describe("computeCheckScore", () => {
  it("returns 100 when there are no violations", () => {
    expect(computeCheckScore(0, 10)).toBe(100);
  });

  it("returns 0 when everything is a violation", () => {
    expect(computeCheckScore(10, 10)).toBe(0);
  });

  it("returns 100 when there are zero opportunities", () => {
    expect(computeCheckScore(0, 0)).toBe(100);
  });

  it("calculates partial scores correctly", () => {
    expect(computeCheckScore(2, 10)).toBe(80);
    expect(computeCheckScore(5, 10)).toBe(50);
    expect(computeCheckScore(1, 4)).toBe(75);
  });

  it("rounds scores", () => {
    expect(computeCheckScore(1, 3)).toBe(67);
    expect(computeCheckScore(2, 3)).toBe(33);
  });
});

describe("computeComponentScore", () => {
  it("returns 0 for empty results", () => {
    expect(computeComponentScore({}, {})).toBe(0);
  });

  it("computes weighted average correctly", () => {
    const results: Record<string, CheckResult> = {
      "hardcoded-colors": {
        checkId: "hardcoded-colors",
        score: 80,
        status: "partial",
        violations: [],
        summary: { template: "test", params: {} },
      },
      "hardcoded-spacing": {
        checkId: "hardcoded-spacing",
        score: 60,
        status: "partial",
        violations: [],
        summary: { template: "test", params: {} },
      },
    };
    const weights = { "hardcoded-colors": 0.25, "hardcoded-spacing": 0.15 };
    const score = computeComponentScore(results, weights);
    expect(score).toBe(73);
  });

  it("excludes notApplicable results from score calculation", () => {
    const results: Record<string, CheckResult> = {
      "hardcoded-colors": {
        checkId: "hardcoded-colors",
        score: 80,
        status: "partial",
        violations: [],
        summary: { template: "test", params: {} },
      },
      "state-variables": {
        checkId: "state-variables",
        score: 100,
        status: "pass",
        violations: [],
        summary: { template: "check_not_applicable", params: {} },
        notApplicable: true,
      },
    };
    const weights = { "hardcoded-colors": 0.25, "state-variables": 0.15 };
    const score = computeComponentScore(results, weights);
    expect(score).toBe(80);
  });

  it("returns 0 when all results are notApplicable", () => {
    const results: Record<string, CheckResult> = {
      "state-variables": {
        checkId: "state-variables",
        score: 100,
        status: "pass",
        violations: [],
        summary: { template: "check_not_applicable", params: {} },
        notApplicable: true,
      },
    };
    const weights = { "state-variables": 0.15 };
    const score = computeComponentScore(results, weights);
    expect(score).toBe(0);
  });
});

describe("computeTotalScore", () => {
  it("returns 0 for empty array", () => {
    expect(computeTotalScore([])).toBe(0);
  });

  it("averages component scores", () => {
    expect(computeTotalScore([80, 60])).toBe(70);
  });
});

describe("determineStatus", () => {
  it("returns pass for 100", () => {
    expect(determineStatus(100)).toBe("pass");
  });

  it("returns partial for 50-99", () => {
    expect(determineStatus(80)).toBe("partial");
    expect(determineStatus(50)).toBe("partial");
  });

  it("returns fail for <50", () => {
    expect(determineStatus(49)).toBe("fail");
    expect(determineStatus(0)).toBe("fail");
  });
});