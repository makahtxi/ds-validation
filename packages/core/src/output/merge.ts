import type { AuditResult, ComponentSummary } from "../types/checks.js";
import { computeTotalScore } from "../scoring/score.js";
import { buildSummary } from "../templates/templates.js";
import { sanitizeComponentName } from "./sanitize.js";

export interface MergeAuditOptions {
  existing: AuditResult;
  newResult: AuditResult;
  newComponentSummaries: ComponentSummary[];
  newPageNames: string[];
  skippedCheckNames?: string[];
}

export function mergeAuditResults(options: MergeAuditOptions): AuditResult {
  const { existing, newResult, newComponentSummaries, newPageNames, skippedCheckNames } = options;

  const existingMap = new Map<string, ComponentSummary>(
    existing.components.map((c) => [c.name, c]),
  );

  for (const summary of newComponentSummaries) {
    existingMap.set(summary.name, summary);
  }

  const mergedComponents = Array.from(existingMap.values());
  const mergedTotalScore = computeTotalScore(
    mergedComponents.map((c) => c.score),
  );

  const allPages = [
    ...new Set([
      ...existing.meta.pagesAudited,
      ...newPageNames,
    ]),
  ];

  const summaryParams: Record<string, string | number> = {
    componentCount: mergedComponents.length,
    totalScore: mergedTotalScore,
  };

  if (skippedCheckNames && skippedCheckNames.length > 0) {
    summaryParams.skippedChecks = skippedCheckNames.join(", ");
  }

  return {
    meta: {
      figmaFileKey: newResult.meta.figmaFileKey,
      figmaFileName: newResult.meta.figmaFileName,
      auditedAt: newResult.meta.auditedAt,
      pagesAudited: allPages,
      conformanceChecks: newResult.meta.conformanceChecks,
    },
    totalScore: mergedTotalScore,
    summary: buildSummary(
      skippedCheckNames && skippedCheckNames.length > 0
        ? "audit_overview_partial"
        : "audit_overview",
      summaryParams,
    ),
    components: mergedComponents,
  };
}

export function buildComponentSummary(
  componentName: string,
  score: number,
  passedChecks: number,
  totalChecks: number,
  pageName: string,
): ComponentSummary {
  return {
    name: componentName,
    score,
    jsonPath: `components/${sanitizeComponentName(componentName)}.json`,
    passedChecks,
    totalChecks,
    pageName,
  };
}
