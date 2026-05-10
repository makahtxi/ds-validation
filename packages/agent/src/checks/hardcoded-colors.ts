import type {
  ConformanceCheck,
  CheckContext,
  CheckResult,
  Violation,
  FigmaNode,
  FigmaPaint,
} from "@ds-validation/core";
import { computeCheckScore, determineStatus, buildSummary } from "@ds-validation/core";

const COMPONENT_BOUND_COLOR = "#9747ff";

function isComponentBoundStroke(paint: FigmaPaint): boolean {
  if (paint.type !== "SOLID" || !paint.color) return false;
  const hex = rgbToHex(paint.color.r, paint.color.g, paint.color.b);
  return hex.toLowerCase() === COMPONENT_BOUND_COLOR;
}

function collectViolations(
  node: FigmaNode,
  path: string,
  context: CheckContext,
  violations: Violation[],
): number {
  let totalPaints = 0;
  const nodePath = path ? `${path} > ${node.name}` : node.name;

  if (node.visible === false) {
    return 0;
  }

  if (node.type !== "COMPONENT_SET") {
    if (node.fills && node.fills.length > 0) {
      for (let i = 0; i < node.fills.length; i++) {
        const paint = node.fills[i] as FigmaPaint;

        if (paint.visible === false) continue;

        totalPaints++;
        if (paint.type === "SOLID" || paint.type === "GRADIENT_LINEAR" || paint.type === "GRADIENT_RADIAL" || paint.type === "GRADIENT_ANGULAR" || paint.type === "GRADIENT_DIAMOND") {
          const hasStyle = !!paint.styleId;
          const hasVariable =
            paint.boundVariables &&
            Object.keys(paint.boundVariables).length > 0;

          if (!hasStyle && !hasVariable) {
            const rawValue = paint.color
              ? rgbToHex(paint.color.r, paint.color.g, paint.color.b)
              : paint.type;
            violations.push({
              nodePath: nodePath,
              property: `fills[${i}]`,
              rawValue,
              expected: "A semantic color variable",
            });
          }
        }
      }
    }

    if (node.strokes && node.strokes.length > 0) {
      for (let i = 0; i < node.strokes.length; i++) {
        const paint = node.strokes[i] as FigmaPaint;

        if (paint.visible === false) continue;
        if (isComponentBoundStroke(paint)) continue;

        totalPaints++;
        if (paint.type === "SOLID" || paint.type === "GRADIENT_LINEAR" || paint.type === "GRADIENT_RADIAL" || paint.type === "GRADIENT_ANGULAR" || paint.type === "GRADIENT_DIAMOND") {
          const hasStyle = !!paint.styleId;
          const hasVariable =
            paint.boundVariables &&
            Object.keys(paint.boundVariables).length > 0;

          if (!hasStyle && !hasVariable) {
            const rawValue = paint.color
              ? rgbToHex(paint.color.r, paint.color.g, paint.color.b)
              : paint.type;
            violations.push({
              nodePath: nodePath,
              property: `strokes[${i}]`,
              rawValue,
              expected: "A semantic color variable",
            });
          }
        }
      }
    }
  }

  for (const child of node.children ?? []) {
    totalPaints += collectViolations(child, nodePath, context, violations);
  }

  return totalPaints;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => {
    const hex = Math.round(v * 255).toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export const hardcodedColorsCheck: ConformanceCheck = {
  id: "hardcoded-colors",
  name: "No Hard-Coded Colors",
  weight: 0.25,

  async run(context: CheckContext): Promise<CheckResult> {
    const violations: Violation[] = [];
    const totalPaints = collectViolations(
      context.componentNode,
      "",
      context,
      violations,
    );

    const score = computeCheckScore(violations.length, totalPaints);
    const status = determineStatus(score);

    const summary =
      violations.length > 0
        ? buildSummary("hardcoded_colors_found", { count: violations.length })
        : buildSummary("hardcoded_colors_clean");

    return {
      checkId: this.id,
      score,
      status,
      violations,
      summary,
    };
  },
};