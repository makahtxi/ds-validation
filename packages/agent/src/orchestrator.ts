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
  FigmaColor,
  FigmaPaint,
  Violation,
  ComponentClassification,
} from "@ds-validation/core";
import { computeComponentScore, computeTotalScore, computeCheckScore, determineStatus, buildSummary, sanitizeComponentName, blendColor } from "@ds-validation/core";
import { registry } from "./checks/registry.js";
import { visitColorNode } from "./checks/hardcoded-colors.js";
import { visitSpacingNode } from "./checks/hardcoded-spacing.js";
import { visitTextStyleNode } from "./checks/hardcoded-text-styles.js";
import { type TokenRef, visitTokenRefNode, buildPrimitiveTokensResult } from "./checks/no-primitive-tokens.js";
import { compositeNodeFills, checkTextContrast, isDisabledVariant } from "./checks/accessibility-contrast.js";

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

// ---------------------------------------------------------------------------
// Single-pass tree walker — visits each node ONCE and runs all check logic
// ---------------------------------------------------------------------------

const WHITE_BG: FigmaColor = { r: 1, g: 1, b: 1, a: 1 };

/** IDs handled by the combined tree walk (everything except state-variables). */
const TREE_WALK_CHECK_IDS = new Set([
  "hardcoded-colors",
  "hardcoded-spacing",
  "hardcoded-text-styles",
  "no-primitive-tokens",
  "accessibility-contrast",
]);

interface CombinedWalkResult {
  colorViolations: Violation[];
  totalPaints: number;
  spacingViolations: Violation[];
  totalSpacing: number;
  textStyleViolations: Violation[];
  totalTextProps: number;
  tokenRefs: TokenRef[];
  contrastViolations: Violation[];
  totalTextNodes: number;
}

function createCombinedWalkResult(): CombinedWalkResult {
  return {
    colorViolations: [],
    totalPaints: 0,
    spacingViolations: [],
    totalSpacing: 0,
    textStyleViolations: [],
    totalTextProps: 0,
    tokenRefs: [],
    contrastViolations: [],
    totalTextNodes: 0,
  };
}

/**
 * Walk the component tree once, running all tree-walking check logic at each node.
 *
 * @param skipContrast - true when this subtree is a disabled variant (contrast skipped,
 *                       other checks still run to match pre-existing behaviour).
 */
function walkAllChecks(
  node: FigmaNode,
  path: string,
  bgColor: FigmaColor,
  bgVarName: string | undefined,
  context: CheckContext,
  result: CombinedWalkResult,
  skipContrast: boolean,
): void {
  if (node.visible === false) return;
  const nodePath = path ? `${path} > ${node.name}` : node.name;

  // COMPONENT_SET — skip per-node checks on the wrapper itself; recurse into
  // children with disabled-variant filtering for the contrast check only.
  if (node.type === "COMPONENT_SET") {
    let siblingBg = bgColor;
    let siblingBgVarName = bgVarName;
    for (const child of node.children ?? []) {
      const childIsDisabled = isDisabledVariant(child);
      walkAllChecks(child, nodePath, siblingBg, siblingBgVarName, context, result, childIsDisabled);
      // Update sibling bg only for non-disabled children (mirrors original contrast walk)
      if (!childIsDisabled && child.type !== "TEXT") {
        const fills = child.fills as FigmaPaint[] | undefined;
        if (fills?.length) {
          const composite = compositeNodeFills(fills, context);
          if (composite.color) {
            siblingBg = blendColor(siblingBg, composite.color, composite.color.a * (child.opacity ?? 1));
            siblingBgVarName = composite.varName ?? siblingBgVarName;
          }
        }
      }
    }
    return;
  }

  // ---- per-node checks ----
  result.totalPaints   += visitColorNode(node, nodePath, result.colorViolations);
  result.totalSpacing  += visitSpacingNode(node, nodePath, result.spacingViolations);
  result.totalTextProps += visitTextStyleNode(node, nodePath, result.textStyleViolations);
  visitTokenRefNode(node, nodePath, result.tokenRefs);

  if (!skipContrast && node.type === "TEXT") {
    result.totalTextNodes += checkTextContrast(
      node, nodePath, bgColor, bgVarName, context, result.contrastViolations,
    );
  }

  // Compute background colour inherited by children
  let childBg = bgColor;
  let childBgVarName = bgVarName;
  if (node.type !== "TEXT") {
    const fills = node.fills as FigmaPaint[] | undefined;
    if (fills?.length) {
      const composite = compositeNodeFills(fills, context);
      if (composite.color) {
        childBg = blendColor(childBg, composite.color, composite.color.a * (node.opacity ?? 1));
        childBgVarName = composite.varName ?? childBgVarName;
      }
    }
  }

  // Recurse with sibling-background accumulation (mirrors original contrast walk)
  let siblingBg = childBg;
  let siblingBgVarName = childBgVarName;
  for (const child of node.children ?? []) {
    walkAllChecks(child, nodePath, siblingBg, siblingBgVarName, context, result, skipContrast);
    if (child.type !== "TEXT") {
      const fills = child.fills as FigmaPaint[] | undefined;
      if (fills?.length) {
        const composite = compositeNodeFills(fills, context);
        if (composite.color) {
          siblingBg = blendColor(siblingBg, composite.color, composite.color.a * (child.opacity ?? 1));
          siblingBgVarName = composite.varName ?? siblingBgVarName;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------

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

  const allChecks = registry.getAll();
  const enabledChecks = allChecks.filter((check) => {
    const override = checkOverrides?.[check.id];
    return override?.enabled !== false;
  });

  for (const check of enabledChecks) {
    weights[check.id] = checkWeights?.[check.id] ?? check.weight;
  }

  // Determine which tree-walk checks are enabled and not marked N/A
  const enabledTreeWalkIds = new Set(
    enabledChecks
      .filter((c) => TREE_WALK_CHECK_IDS.has(c.id) && classifications?.[c.id] !== "non-interactive")
      .map((c) => c.id),
  );

  // Single combined tree walk replaces 5 independent recursive passes
  if (enabledTreeWalkIds.size > 0) {
    const walked = createCombinedWalkResult();
    walkAllChecks(componentNode, "", WHITE_BG, undefined, context, walked, false);

    // Derive a CheckResult for each tree-walk check from the shared accumulator
    if (enabledTreeWalkIds.has("hardcoded-colors")) {
      const score = computeCheckScore(walked.colorViolations.length, walked.totalPaints);
      checkResults["hardcoded-colors"] = {
        checkId: "hardcoded-colors",
        score,
        status: determineStatus(score),
        violations: walked.colorViolations,
        summary: walked.colorViolations.length > 0
          ? buildSummary("hardcoded_colors_found", { count: walked.colorViolations.length })
          : buildSummary("hardcoded_colors_clean"),
      };
    }

    if (enabledTreeWalkIds.has("hardcoded-spacing")) {
      const score = computeCheckScore(walked.spacingViolations.length, walked.totalSpacing);
      checkResults["hardcoded-spacing"] = {
        checkId: "hardcoded-spacing",
        score,
        status: determineStatus(score),
        violations: walked.spacingViolations,
        summary: walked.spacingViolations.length > 0
          ? buildSummary("hardcoded_spacing_found", { count: walked.spacingViolations.length })
          : buildSummary("hardcoded_spacing_clean"),
      };
    }

    if (enabledTreeWalkIds.has("hardcoded-text-styles")) {
      const score = computeCheckScore(walked.textStyleViolations.length, walked.totalTextProps);
      checkResults["hardcoded-text-styles"] = {
        checkId: "hardcoded-text-styles",
        score,
        status: determineStatus(score),
        violations: walked.textStyleViolations,
        summary: walked.textStyleViolations.length > 0
          ? buildSummary("hardcoded_text_styles_found", { count: walked.textStyleViolations.length })
          : buildSummary("hardcoded_text_styles_clean"),
      };
    }

    if (enabledTreeWalkIds.has("no-primitive-tokens")) {
      checkResults["no-primitive-tokens"] = buildPrimitiveTokensResult(
        "no-primitive-tokens",
        walked.tokenRefs,
        context,
      );
    }

    if (enabledTreeWalkIds.has("accessibility-contrast")) {
      const score = computeCheckScore(walked.contrastViolations.length, walked.totalTextNodes);
      checkResults["accessibility-contrast"] = {
        checkId: "accessibility-contrast",
        score,
        status: determineStatus(score),
        violations: walked.contrastViolations,
        summary: walked.contrastViolations.length > 0
          ? buildSummary("contrast_found", { count: walked.contrastViolations.length })
          : buildSummary("contrast_clean"),
      };
    }
  }

  // N/A results for tree-walk checks that are classified non-interactive
  for (const check of enabledChecks.filter(
    (c) => TREE_WALK_CHECK_IDS.has(c.id) && classifications?.[c.id] === "non-interactive",
  )) {
    checkResults[check.id] = createNAResult(check.id, componentName);
  }

  // Non-tree-walk checks (e.g. state-variables) run via the registry as before
  for (const check of enabledChecks.filter((c) => !TREE_WALK_CHECK_IDS.has(c.id))) {
    if (classifications?.[check.id] === "non-interactive") {
      checkResults[check.id] = createNAResult(check.id, componentName);
      continue;
    }
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