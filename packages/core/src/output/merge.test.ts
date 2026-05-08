import { describe, it, expect } from "vitest";
import { mergeAuditResults, buildComponentSummary } from "./merge.js";
import type { AuditResult, ComponentSummary } from "../types/checks.js";

function makeAuditResult(overrides?: Partial<AuditResult>): AuditResult {
  return {
    meta: {
      figmaFileKey: "test-file-key",
      figmaFileName: "Test File",
      auditedAt: new Date().toISOString(),
      pagesAudited: ["Page 1"],
      conformanceChecks: [
        { id: "hardcoded-colors", name: "No Hard-Coded Colors", weight: 0.25 },
      ],
    },
    totalScore: 75,
    summary: { template: "audit_overview", params: { componentCount: 1, totalScore: 75 } },
    components: [
      {
        name: "Button",
        score: 75,
        jsonPath: "components/Button.json",
        passedChecks: 3,
        totalChecks: 5,
        pageName: "Page 1",
      },
    ],
    ...overrides,
  };
}

describe("mergeAuditResults", () => {
  it("merges new components into existing audit", () => {
    const existing = makeAuditResult({
      components: [
        { name: "Button", score: 75, jsonPath: "components/Button.json", passedChecks: 3, totalChecks: 5, pageName: "Page 1" },
        { name: "Input", score: 60, jsonPath: "components/Input.json", passedChecks: 2, totalChecks: 5, pageName: "Page 1" },
      ],
      totalScore: 68,
    });

    const newResult = makeAuditResult({
      components: [
        { name: "Button", score: 90, jsonPath: "components/Button.json", passedChecks: 4, totalChecks: 5, pageName: "Page 1" },
      ],
      totalScore: 90,
    });

    const newSummaries = [
      { name: "Button", score: 90, jsonPath: "components/Button.json", passedChecks: 4, totalChecks: 5, pageName: "Page 1" },
    ];

    const merged = mergeAuditResults({
      existing,
      newResult,
      newComponentSummaries: newSummaries,
      newPageNames: ["Page 1"],
    });

    expect(merged.components).toHaveLength(2);
    const button = merged.components.find((c) => c.name === "Button");
    const input = merged.components.find((c) => c.name === "Input");

    expect(button!.score).toBe(90);
    expect(input!.score).toBe(60);
  });

  it("preserves unaudited components from existing audit", () => {
    const existing = makeAuditResult({
      components: [
        { name: "Button", score: 75, jsonPath: "components/Button.json", passedChecks: 3, totalChecks: 5, pageName: "Page 1" },
        { name: "Modal", score: 50, jsonPath: "components/Modal.json", passedChecks: 1, totalChecks: 5, pageName: "Page 2" },
      ],
      totalScore: 63,
    });

    const newResult = makeAuditResult({
      components: [
        { name: "Button", score: 80, jsonPath: "components/Button.json", passedChecks: 4, totalChecks: 5, pageName: "Page 1" },
      ],
      totalScore: 80,
    });

    const newSummaries = [
      { name: "Button", score: 80, jsonPath: "components/Button.json", passedChecks: 4, totalChecks: 5, pageName: "Page 1" },
    ];

    const merged = mergeAuditResults({
      existing,
      newResult,
      newComponentSummaries: newSummaries,
      newPageNames: ["Page 1"],
    });

    expect(merged.components).toHaveLength(2);
    const modal = merged.components.find((c) => c.name === "Modal");
    expect(modal).toBeDefined();
    expect(modal!.score).toBe(50);
  });

  it("calculates total score from all merged components", () => {
    const existing = makeAuditResult({
      components: [
        { name: "Button", score: 80, jsonPath: "components/Button.json", passedChecks: 4, totalChecks: 5, pageName: "Page 1" },
        { name: "Input", score: 60, jsonPath: "components/Input.json", passedChecks: 3, totalChecks: 5, pageName: "Page 1" },
      ],
      totalScore: 70,
    });

    const newResult = makeAuditResult({
      components: [
        { name: "Button", score: 100, jsonPath: "components/Button.json", passedChecks: 5, totalChecks: 5, pageName: "Page 1" },
      ],
      totalScore: 100,
    });

    const newSummaries = [
      { name: "Button", score: 100, jsonPath: "components/Button.json", passedChecks: 5, totalChecks: 5, pageName: "Page 1" },
    ];

    const merged = mergeAuditResults({
      existing,
      newResult,
      newComponentSummaries: newSummaries,
      newPageNames: ["Page 1"],
    });

    expect(merged.totalScore).toBe(80);
  });

  it("merges pagesAudited cumulatively", () => {
    const existing = makeAuditResult({
      meta: {
        figmaFileKey: "test-file-key",
        figmaFileName: "Test File",
        auditedAt: new Date().toISOString(),
        pagesAudited: ["Page 1", "Page 2"],
        conformanceChecks: [],
      },
    });

    const newResult = makeAuditResult({
      meta: {
        figmaFileKey: "test-file-key",
        figmaFileName: "Test File",
        auditedAt: new Date().toISOString(),
        pagesAudited: ["Page 2", "Page 3"],
        conformanceChecks: [],
      },
    });

    const merged = mergeAuditResults({
      existing,
      newResult,
      newComponentSummaries: [],
      newPageNames: ["Page 2", "Page 3"],
    });

    expect(merged.meta.pagesAudited).toContain("Page 1");
    expect(merged.meta.pagesAudited).toContain("Page 2");
    expect(merged.meta.pagesAudited).toContain("Page 3");
    expect(merged.meta.pagesAudited).toHaveLength(3);
  });

  it("uses audit_overview_partial template when checks are skipped", () => {
    const existing = makeAuditResult();
    const newResult = makeAuditResult();

    const merged = mergeAuditResults({
      existing,
      newResult,
      newComponentSummaries: [],
      newPageNames: ["Page 1"],
      skippedCheckNames: ["No Primitive Tokens"],
    });

    expect(merged.summary.template).toBe("audit_overview_partial");
    expect(merged.summary.params.skippedChecks).toBe("No Primitive Tokens");
  });

  it("uses audit_overview template when no checks are skipped", () => {
    const existing = makeAuditResult();
    const newResult = makeAuditResult();

    const merged = mergeAuditResults({
      existing,
      newResult,
      newComponentSummaries: [],
      newPageNames: ["Page 1"],
    });

    expect(merged.summary.template).toBe("audit_overview");
  });

  it("updates meta from the new result", () => {
    const existing = makeAuditResult({
      meta: {
        figmaFileKey: "test-file-key",
        figmaFileName: "Old File",
        auditedAt: "2024-01-01T00:00:00.000Z",
        pagesAudited: ["Page 1"],
        conformanceChecks: [],
      },
    });

    const newResult = makeAuditResult({
      meta: {
        figmaFileKey: "test-file-key",
        figmaFileName: "New File",
        auditedAt: "2025-06-01T00:00:00.000Z",
        pagesAudited: ["Page 1"],
        conformanceChecks: [
          { id: "hardcoded-colors", name: "No Hard-Coded Colors", weight: 0.25 },
        ],
      },
    });

    const merged = mergeAuditResults({
      existing,
      newResult,
      newComponentSummaries: [],
      newPageNames: ["Page 1"],
    });

    expect(merged.meta.figmaFileName).toBe("New File");
    expect(merged.meta.auditedAt).toBe("2025-06-01T00:00:00.000Z");
  });
});

describe("buildComponentSummary", () => {
  it("creates a valid component summary", () => {
    const summary = buildComponentSummary("Button", 80, 4, 5, "Page 1");

    expect(summary).toEqual({
      name: "Button",
      score: 80,
      jsonPath: "components/Button.json",
      passedChecks: 4,
      totalChecks: 5,
      pageName: "Page 1",
    });
  });

  it("sanitizes component name in jsonPath", () => {
    const summary = buildComponentSummary("My/Button", 80, 4, 5, "Page 1");

    expect(summary.jsonPath).toBe("components/My_Button.json");
  });
});
