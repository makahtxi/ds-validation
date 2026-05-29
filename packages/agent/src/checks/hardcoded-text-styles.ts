import type {
  ConformanceCheck,
  CheckContext,
  CheckResult,
  Violation,
  FigmaNode,
  FigmaTypeStyle,
} from "@ds-validation/core";
import { computeCheckScore, determineStatus, buildSummary } from "@ds-validation/core";

const TEXT_STYLE_PROPERTIES = [
  "fontFamily",
  "fontSize",
  "lineHeight",
  "letterSpacing",
] as const;

/**
 * Per-node text-style check — only meaningful for TEXT nodes.
 * Called by both the single-pass walker and collectViolations.
 */
export function visitTextStyleNode(
  node: FigmaNode,
  nodePath: string,
  violations: Violation[],
): number {
  if (node.type !== "TEXT") return 0;

  if (node.styleId) {
    return 4; // all 4 properties pass via the applied style
  }

  const style = node.style ?? ({} as FigmaTypeStyle);
  const bv = node.boundVariables ?? {};
  let totalTextProps = 0;

  totalTextProps++;
  if (!bv["fontFamily"]) {
    violations.push({ nodePath, property: "fontFamily", rawValue: style.fontFamily ?? "unknown", expected: "A text style or variable" });
  }

  totalTextProps++;
  if (!bv["fontSize"]) {
    violations.push({ nodePath, property: "fontSize", rawValue: style.fontSize ? String(style.fontSize) : "unknown", expected: "A text style or variable" });
  }

  totalTextProps++;
  const lineHeightUnit = style.lineHeightUnit;
  if (lineHeightUnit !== "AUTO" && lineHeightUnit !== "INSIDE" && !bv["lineHeight"]) {
    violations.push({ nodePath, property: "lineHeight", rawValue: style.lineHeightPx ? String(style.lineHeightPx) : "unknown", expected: "A text style or variable (AUTO is acceptable)" });
  }

  totalTextProps++;
  const letterSpacing = style.letterSpacing;
  if (letterSpacing !== 0 && letterSpacing !== undefined && !bv["letterSpacing"]) {
    violations.push({ nodePath, property: "letterSpacing", rawValue: String(letterSpacing), expected: "A text style or variable (0% is acceptable)" });
  }

  return totalTextProps;
}

function collectViolations(
  node: FigmaNode,
  path: string,
  context: CheckContext,
  violations: Violation[],
): number {
  const nodePath = path ? `${path} > ${node.name}` : node.name;
  let totalTextProps = visitTextStyleNode(node, nodePath, violations);

  for (const child of node.children ?? []) {
    totalTextProps += collectViolations(child, nodePath, context, violations);
  }

  return totalTextProps;
}

export const hardcodedTextStylesCheck: ConformanceCheck = {
  id: "hardcoded-text-styles",
  name: "No Hard-Coded Text Styles",
  weight: 0.2,

  async run(context: CheckContext): Promise<CheckResult> {
    const violations: Violation[] = [];
    const totalTextProps = collectViolations(
      context.componentNode,
      "",
      context,
      violations,
    );

    const score = computeCheckScore(violations.length, totalTextProps);
    const status = determineStatus(score);

    const summary =
      violations.length > 0
        ? buildSummary("hardcoded_text_styles_found", { count: violations.length })
        : buildSummary("hardcoded_text_styles_clean");

    return {
      checkId: this.id,
      score,
      status,
      violations,
      summary,
    };
  },
};