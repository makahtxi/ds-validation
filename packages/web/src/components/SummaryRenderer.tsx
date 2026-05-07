import { SUMMARY_TEMPLATES } from "@ds-validation/core";

interface SummaryRendererProps {
  entry: { template: string; params: Record<string, string | number> };
}

export function renderSummary(entry: SummaryRendererProps["entry"]): string {
  const renderer = SUMMARY_TEMPLATES[entry.template];
  if (!renderer) {
    return `[Unknown template: ${entry.template}]`;
  }
  return renderer(entry.params);
}

export function SummaryRenderer({ entry }: SummaryRendererProps) {
  return <p className="text-gray-700">{renderSummary(entry)}</p>;
}