import { describe, it, expect } from "vitest";
import { SUMMARY_TEMPLATES, buildSummary, renderSummary } from "./templates";

describe("SUMMARY_TEMPLATES", () => {
  it("renders hardcoded_colors_found", () => {
    expect(SUMMARY_TEMPLATES.hardcoded_colors_found({ count: 3 })).toBe(
      "Found 3 hard-coded color(s)",
    );
  });

  it("renders hardcoded_colors_clean", () => {
    expect(SUMMARY_TEMPLATES.hardcoded_colors_clean({})).toBe(
      "All colors use design tokens",
    );
  });

  it("renders state_variables_partial", () => {
    expect(SUMMARY_TEMPLATES.state_variables_partial({ found: 3, total: 5 })).toBe(
      "Found 3 of 5 state variables",
    );
  });
});

describe("buildSummary", () => {
  it("creates a SummaryEntry with params", () => {
    const entry = buildSummary("hardcoded_colors_found", { count: 2 });
    expect(entry).toEqual({
      template: "hardcoded_colors_found",
      params: { count: 2 },
    });
  });

  it("creates a SummaryEntry with empty params", () => {
    const entry = buildSummary("hardcoded_colors_clean");
    expect(entry).toEqual({
      template: "hardcoded_colors_clean",
      params: {},
    });
  });
});

describe("renderSummary", () => {
  it("renders a known template", () => {
    expect(renderSummary(buildSummary("hardcoded_colors_found", { count: 5 }))).toBe(
      "Found 5 hard-coded color(s)",
    );
  });

  it("renders unknown template gracefully", () => {
    expect(renderSummary(buildSummary("unknown_template", {}))).toBe(
      "[Unknown template: unknown_template]",
    );
  });
});