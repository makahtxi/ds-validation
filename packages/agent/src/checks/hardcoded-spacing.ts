import type {
  ConformanceCheck,
  CheckContext,
  CheckResult,
  Violation,
  FigmaNode,
} from "@ds-validation/core";
import { computeCheckScore, determineStatus, buildSummary } from "@ds-validation/core";

const SPACING_PROPERTIES = [
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "paddingBottom",
  "itemSpacing",
] as const;

const CORNER_RADIUS_KEYS = [
  "RECTANGLE_TOP_LEFT_CORNER_RADIUS",
  "RECTANGLE_TOP_RIGHT_CORNER_RADIUS",
  "RECTANGLE_BOTTOM_LEFT_CORNER_RADIUS",
  "RECTANGLE_BOTTOM_RIGHT_CORNER_RADIUS",
] as const;

function collectViolations(
  node: FigmaNode,
  path: string,
  context: CheckContext,
  violations: Violation[],
): number {
  let totalSpacingProps = 0;
  const nodePath = path ? `${path} > ${node.name}` : node.name;

  for (const prop of SPACING_PROPERTIES) {
    const value = node[prop];
    if (value !== undefined && value !== 0) {
      totalSpacingProps++;
      const boundVar = node.boundVariables?.[prop];
      if (!boundVar) {
        violations.push({
          nodePath,
          property: prop,
          rawValue: String(value),
          expected: "A semantic spacing variable",
        });
      }
    }
  }

  const radii = node.rectangleCornerRadii;
  if (radii && radii.some((r) => r > 0)) {
    const bvRadii = node.boundVariables?.["rectangleCornerRadii"] as
      | Record<string, unknown>
      | undefined;
    for (let i = 0; i < CORNER_RADIUS_KEYS.length; i++) {
      totalSpacingProps++;
      if (!bvRadii?.[CORNER_RADIUS_KEYS[i]]) {
        violations.push({
          nodePath,
          property: `rectangleCornerRadii.${CORNER_RADIUS_KEYS[i]}`,
          rawValue: String(radii[i]),
          expected: "A semantic spacing variable",
        });
      }
    }
  }

  if (!node.layoutMode || node.layoutMode === "NONE") {
    if (node.x !== undefined && node.x !== 0) {
      totalSpacingProps++;
      if (!node.boundVariables?.["x"]) {
        violations.push({
          nodePath,
          property: "x",
          rawValue: String(node.x),
          expected: "A semantic spacing variable",
        });
      }
    }
    if (node.y !== undefined && node.y !== 0) {
      totalSpacingProps++;
      if (!node.boundVariables?.["y"]) {
        violations.push({
          nodePath,
          property: "y",
          rawValue: String(node.y),
          expected: "A semantic spacing variable",
        });
      }
    }
  }

  for (const child of node.children ?? []) {
    totalSpacingProps += collectViolations(child, nodePath, context, violations);
  }

  return totalSpacingProps;
}

export const hardcodedSpacingCheck: ConformanceCheck = {
  id: "hardcoded-spacing",
  name: "No Hard-Coded Spacing",
  weight: 0.15,

  async run(context: CheckContext): Promise<CheckResult> {
    const violations: Violation[] = [];
    const totalSpacingProps = collectViolations(
      context.componentNode,
      "",
      context,
      violations,
    );

    const score = computeCheckScore(violations.length, totalSpacingProps);
    const status = determineStatus(score);

    const summary =
      violations.length > 0
        ? buildSummary("hardcoded_spacing_found", { count: violations.length })
        : buildSummary("hardcoded_spacing_clean");

    return {
      checkId: this.id,
      score,
      status,
      violations,
      summary,
    };
  },
};