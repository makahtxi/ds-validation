import type {
  CheckContext,
  CheckResult,
  ComponentAuditResult,
  ComponentSummary,
  AuditResult,
  AuditMeta,
  ConformanceCheckConfig,
  FigmaNode,
  FigmaStyle,
  FigmaVariable,
  ComponentClassification,
} from "@ds-validation/core";
import { computeComponentScore, computeTotalScore, buildSummary, sanitizeComponentName } from "@ds-validation/core";
import { registry } from "./checks/registry.js";
import { classifyComponent } from "./classifier.js";

export interface AuditFileResult {
  audit: AuditResult;
  components: ComponentAuditResult[];
}

export interface AuditFileOptions {
  fileKey: string;
  fileName: string;
  pageNames: string[];
  componentNodes: Map<string, FigmaNode>;
  componentPageMap: Map<string, string>;
  styles: Record<string, FigmaStyle>;
  variables: Record<string, FigmaVariable>;
  checkWeights?: Record<string, number>;
  checkOverrides?: Record<string, { enabled?: boolean; weight?: number }>;
  classifications?: Record<string, Record<string, ComponentClassification>>;
}

function createNAResult(checkId: string, componentName: string): CheckResult {
  return {
    checkId,
    score: 100,
    status: "pass",
    violations: [],
    summary: {
      template: "check_not_applicable",
      params: { checkId, componentName },
    },
    notApplicable: true,
  };
}

export async function auditComponent(
  componentName: string,
  componentNode: FigmaNode,
  pageName: string,
  styles: Record<string, FigmaStyle>,
  variables: Record<string, FigmaVariable>,
  checkWeights?: Record<string, number>,
  checkOverrides?: Record<string, { enabled?: boolean; weight?: number }>,
  classifications?: Record<string, ComponentClassification>,
): Promise<ComponentAuditResult> {
  const context: CheckContext = {
    componentNode,
    styles,
    variables,
  };

  const checkResults: Record<string, CheckResult> = {};
  const weights: Record<string, number> = {};

  const checksToRun = registry.getAll().filter((check) => {
    const override = checkOverrides?.[check.id];
    if (override?.enabled === false) return false;
    return true;
  });

  for (const check of checksToRun) {
    const weight = checkWeights?.[check.id] ?? check.weight;
    weights[check.id] = weight;

    if (classifications?.[check.id] === "non-interactive") {
      checkResults[check.id] = createNAResult(check.id, componentName);
      continue;
    }

    if (classifications?.[check.id] === "interactive" || !check.componentRules) {
      try {
        checkResults[check.id] = await check.run(context);
      } catch (error) {
        checkResults[check.id] = {
          checkId: check.id,
          score: 0,
          status: "fail",
          violations: [
            {
              nodePath: componentName,
              property: "check_error",
              rawValue: error instanceof Error ? error.message : String(error),
              expected: "Check should complete without errors",
            },
          ],
          summary: { template: "check_error", params: { checkId: check.id } },
        };
      }
      continue;
    }

    const classification = classifications?.[check.id];
    if (classification === "interactive") {
      try {
        checkResults[check.id] = await check.run(context);
      } catch (error) {
        checkResults[check.id] = {
          checkId: check.id,
          score: 0,
          status: "fail",
          violations: [
            {
              nodePath: componentName,
              property: "check_error",
              rawValue: error instanceof Error ? error.message : String(error),
              expected: "Check should complete without errors",
            },
          ],
          summary: { template: "check_error", params: { checkId: check.id } },
        };
      }
    } else {
      checkResults[check.id] = createNAResult(check.id, componentName);
    }
  }

  const score = computeComponentScore(checkResults, weights);

  return {
    componentName,
    score,
    checkResults,
    pageName,
  };
}

export async function auditFile(
  options: AuditFileOptions,
): Promise<AuditFileResult> {
  const {
    fileKey,
    fileName,
    pageNames,
    componentNodes,
    componentPageMap,
    styles,
    variables,
    checkWeights,
    checkOverrides,
    classifications,
  } = options;

  const checksToRun = registry.getAll().filter((check) => {
    const override = checkOverrides?.[check.id];
    if (override?.enabled === false) return false;
    return true;
  });

  const componentResults: ComponentAuditResult[] = [];
  const componentSummaries: ComponentSummary[] = [];

  for (const [name, node] of componentNodes) {
    const pageName = componentPageMap.get(name) ?? "Unknown";
    const componentClassifications = classifications?.[name];
    const result = await auditComponent(
      name,
      node,
      pageName,
      styles,
      variables,
      checkWeights,
      checkOverrides,
      componentClassifications,
    );
    componentResults.push(result);
    componentSummaries.push({
      name,
      score: result.score,
      jsonPath: `components/${sanitizeComponentName(name)}.json`,
      passedChecks: Object.values(result.checkResults).filter(
        (r) => r.status === "pass",
      ).length,
      totalChecks: Object.keys(result.checkResults).length,
      pageName,
    });
  }

  const totalScore = computeTotalScore(
    componentResults.map((r) => r.score),
  );

  const checkConfigs: ConformanceCheckConfig[] = checksToRun.map((check) => ({
    id: check.id,
    name: check.name,
    weight: checkWeights?.[check.id] ?? check.weight,
  }));

  const skippedChecks = registry.getAll().filter((check) => {
    const override = checkOverrides?.[check.id];
    return override?.enabled === false;
  });

  const meta: AuditMeta = {
    figmaFileKey: fileKey,
    figmaFileName: fileName,
    auditedAt: new Date().toISOString(),
    pagesAudited: pageNames,
    conformanceChecks: checkConfigs,
  };

  const summaryParams: Record<string, string | number> = {
    componentCount: componentResults.length,
    totalScore,
  };

  if (skippedChecks.length > 0) {
    summaryParams.skippedChecks = skippedChecks.map((c) => c.name).join(", ");
  }

  const audit: AuditResult = {
    meta,
    totalScore,
    summary: {
      template: skippedChecks.length > 0 ? "audit_overview_partial" : "audit_overview",
      params: summaryParams,
    },
    components: componentSummaries,
  };

  return { audit, components: componentResults };
}
