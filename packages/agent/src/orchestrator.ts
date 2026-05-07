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
  AIClient,
} from "@ds-validation/core";
import { computeComponentScore, computeTotalScore, buildSummary } from "@ds-validation/core";
import { registry } from "./checks/registry.js";

function createStubAIClient(): AIClient {
  return {
    async classifyToken(tokenName: string) {
      return { classification: "semantic" as const, suggestedReplacement: null };
    },
    async classifyTokens(tokens: string[]) {
      const result: Record<string, { classification: "semantic" | "primitive" | "wrong_category"; suggestedReplacement: string | null }> = {};
      for (const token of tokens) {
        result[token] = { classification: "semantic", suggestedReplacement: null };
      }
      return result;
    },
    async generatePrimitiveTokenSummary() {
      return { template: "primitive_tokens_clean", params: {} };
    },
  };
}

export interface AuditFileResult {
  audit: AuditResult;
  components: ComponentAuditResult[];
}

export interface AuditFileOptions {
  fileKey: string;
  fileName: string;
  pageNames: string[];
  componentNodes: Map<string, FigmaNode>;
  styles: Record<string, FigmaStyle>;
  variables: Record<string, FigmaVariable>;
  ai?: AIClient;
  checkWeights?: Record<string, number>;
  checkOverrides?: Record<string, { enabled?: boolean; weight?: number }>;
}

export async function auditComponent(
  componentName: string,
  componentNode: FigmaNode,
  styles: Record<string, FigmaStyle>,
  variables: Record<string, FigmaVariable>,
  ai?: AIClient,
  checkWeights?: Record<string, number>,
  checkOverrides?: Record<string, { enabled?: boolean; weight?: number }>,
): Promise<ComponentAuditResult> {
  const aiClient = ai ?? createStubAIClient();
  
  const context: CheckContext = {
    componentNode,
    styles,
    variables,
    ai: aiClient,
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
  }

  const score = computeComponentScore(checkResults, weights);

  return {
    componentName,
    score,
    checkResults,
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
    styles,
    variables,
    ai,
    checkWeights,
    checkOverrides,
  } = options;

  const aiClient = ai ?? createStubAIClient();

  const checksToRun = registry.getAll().filter((check) => {
    const override = checkOverrides?.[check.id];
    if (override?.enabled === false) return false;
    return true;
  });

  const componentResults: ComponentAuditResult[] = [];
  const componentSummaries: ComponentSummary[] = [];

  for (const [name, node] of componentNodes) {
    const result = await auditComponent(
      name,
      node,
      styles,
      variables,
      aiClient,
      checkWeights,
      checkOverrides,
    );
    componentResults.push(result);
    componentSummaries.push({
      name,
      score: result.score,
      jsonPath: `components/${name.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`,
      passedChecks: Object.values(result.checkResults).filter(
        (r) => r.status === "pass",
      ).length,
      totalChecks: Object.keys(result.checkResults).length,
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