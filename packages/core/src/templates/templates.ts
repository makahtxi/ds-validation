import type { SummaryEntry } from "../types/checks.js";

export const SUMMARY_TEMPLATES: Record<
  string,
  (params: Record<string, string | number>) => string
> = {
  hardcoded_colors_found: (params) =>
    `Found ${params.count} hard-coded color(s)`,
  hardcoded_colors_clean: () => "All colors use design tokens",
  hardcoded_spacing_found: (params) =>
    `Found ${params.count} hard-coded spacing value(s)`,
  hardcoded_spacing_clean: () => "All spacing uses design tokens",
  hardcoded_text_styles_found: (params) =>
    `Found ${params.count} hard-coded text style(s)`,
  hardcoded_text_styles_clean: () => "All text styles use design tokens",
  primitive_tokens_found: (params) =>
    `Found ${params.count} primitive token(s)${params.examples ? `: ${params.examples}` : ""}`,
  primitive_tokens_clean: () =>
    "All tokens are semantic or component-level",
  wrong_category_usage_found: (params) =>
    `Found ${params.count} wrong-category usage(s)${params.example ? `: ${params.example}` : ""}`,
  state_variables_partial: (params) =>
    `Found ${params.found} of ${params.total} state variables`,
  state_variables_complete: () => "All state variables present",
  audit_overview: (params) =>
    `Audited ${params.componentCount} component(s), score: ${params.totalScore}/100`,
  audit_overview_partial: (params) =>
    `Audited ${params.componentCount} component(s), score: ${params.totalScore}/100. Skipped: ${params.skippedChecks}`,
  check_error: (params) =>
    `Check "${params.checkId}" encountered an error`,
};

export function buildSummary(
  template: string,
  params: Record<string, string | number> = {},
): SummaryEntry {
  return { template, params };
}

export function renderSummary(entry: SummaryEntry): string {
  const renderer = SUMMARY_TEMPLATES[entry.template];
  if (!renderer) {
    return `[Unknown template: ${entry.template}]`;
  }
  return renderer(entry.params);
}