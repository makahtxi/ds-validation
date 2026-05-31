import type {
  ConformanceCheck,
  CheckContext,
  CheckResult,
  Violation,
  FigmaNode,
  FigmaPaint,
} from "@ds-validation/core";
import { computeCheckScore, determineStatus, buildSummary, colorToHex } from "@ds-validation/core";

const COMPONENT_BOUND_COLOR = "#9747ff";

const PAINT_TYPES_TO_CHECK = new Set([
  "SOLID",
  "GRADIENT_LINEAR",
  "GRADIENT_RADIAL",
  "GRADIENT_ANGULAR",
  "GRADIENT_DIAMOND",
]);

function isComponentBoundStroke(paint: FigmaPaint): boolean {
  if (paint.type !== "SOLID" || !paint.color) return false;
  const hex = colorToHex(paint.color);
  return hex.toLowerCase() === COMPONENT_BOUND_COLOR;
}

/** Per-node color check — called by both the single-pass walker and collectViolations. */
export function visitColorNode(
  node: FigmaNode,
  nodePath: string,
  violations: Violation[],
): number {
  let totalPaints = 0;

  if (node.fills && node.fills.length > 0) {
    for (let i = 0; i < node.fills.length; i++) {
      const paint = node.fills[i] as FigmaPaint;
      if (paint.visible === false) continue;
      totalPaints++;
      if (PAINT_TYPES_TO_CHECK.has(paint.type)) {
        const hasStyle = !!paint.styleId;
        const hasVariable = paint.boundVariables && Object.keys(paint.boundVariables).length > 0;
        if (!hasStyle && !hasVariable) {
          violations.push({
            nodePath,
            property: `fills[${i}]`,
            rawValue: paint.color ? colorToHex(paint.color) : paint.type,
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
      if (PAINT_TYPES_TO_CHECK.has(paint.type)) {
        const hasStyle = !!paint.styleId;
        const hasVariable = paint.boundVariables && Object.keys(paint.boundVariables).length > 0;
        if (!hasStyle && !hasVariable) {
          violations.push({
            nodePath,
            property: `strokes[${i}]`,
            rawValue: paint.color ? colorToHex(paint.color) : paint.type,
            expected: "A semantic color variable",
          });
        }
      }
    }
  }

  return totalPaints;
}

function collectViolations(
  node: FigmaNode,
  path: string,
  context: CheckContext,
  violations: Violation[],
): number {
  if (node.visible === false) return 0;

  const nodePath = path ? `${path} > ${node.name}` : node.name;
  let totalPaints = 0;

  if (node.type !== "COMPONENT_SET") {
    totalPaints += visitColorNode(node, nodePath, violations);
  }

  for (const child of node.children ?? []) {
    totalPaints += collectViolations(child, nodePath, context, violations);
  }

  return totalPaints;
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