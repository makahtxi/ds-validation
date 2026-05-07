import type { SummaryEntry } from "@ds-validation/core";
import { SUMMARY_TEMPLATES } from "@ds-validation/core";

export function renderSummary(entry: SummaryEntry): string {
  const renderer = SUMMARY_TEMPLATES[entry.template];
  if (!renderer) {
    return `[Unknown template: ${entry.template}]`;
  }
  return renderer(entry.params);
}