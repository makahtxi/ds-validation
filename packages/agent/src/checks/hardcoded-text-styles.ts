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

function collectViolations(
  node: FigmaNode,
  path: string,
  context: CheckContext,
  violations: Violation[],
): number {
  let totalTextProps = 0;
  const nodePath = path ? `${path} > ${node.name}` : node.name;

  if (node.type === "TEXT") {
    if (node.styleId) {
      // Text node has a style applied — all properties pass via the style
      // Count the 4 main text properties as "checked"
      totalTextProps += 4;
    } else {
      const style = node.style ?? ({} as FigmaTypeStyle);

      // Check boundVariables for text properties
      const bv = node.boundVariables ?? {};

      // fontFamily
      totalTextProps++;
      if (!bv["fontFamily"]) {
        violations.push({
          nodePath,
          property: "fontFamily",
          rawValue: style.fontFamily ?? "unknown",
          expected: "A text style or variable",
        });
      }

      // fontSize
      totalTextProps++;
      if (!bv["fontSize"]) {
        violations.push({
          nodePath,
          property: "fontSize",
          rawValue: style.fontSize ? String(style.fontSize) : "unknown",
          expected: "A text style or variable",
        });
      }

      // lineHeight — AUTO is acceptable
      totalTextProps++;
      const lineHeightUnit = style.lineHeightUnit;
      if (lineHeightUnit === "AUTO" || lineHeightUnit === "INSIDE") {
        // Auto line height is acceptable
      } else if (!bv["lineHeight"]) {
        violations.push({
          nodePath,
          property: "lineHeight",
          rawValue: style.lineHeightPx ? String(style.lineHeightPx) : "unknown",
          expected: "A text style or variable (AUTO is acceptable)",
        });
      }

      // letterSpacing — 0% is acceptable
      totalTextProps++;
      const letterSpacing = style.letterSpacing;
      if (letterSpacing === 0 || letterSpacing === undefined) {
        // Default/0 letter spacing is acceptable
      } else if (!bv["letterSpacing"]) {
        violations.push({
          nodePath,
          property: "letterSpacing",
          rawValue: String(letterSpacing),
          expected: "A text style or variable (0% is acceptable)",
        });
      }
    }
  }

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