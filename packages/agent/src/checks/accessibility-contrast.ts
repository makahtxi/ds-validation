import type {
  ConformanceCheck,
  CheckContext,
  CheckResult,
  Violation,
  FigmaNode,
  FigmaPaint,
  FigmaColor,
  FigmaBoundVariable,
  FigmaVariable,
} from "@ds-validation/core";
import {
  computeCheckScore,
  determineStatus,
  buildSummary,
  contrastRatio,
  blendColor,
  getSolidFillColor,
  colorToHex,
} from "@ds-validation/core";

const WCAG_AA_NORMAL = 4.5;
const WCAG_AA_LARGE = 3.0;
const LARGE_FONT_SIZE = 18;
const LARGE_FONT_SIZE_BOLD = 14;

const WHITE_BG: FigmaColor = { r: 1, g: 1, b: 1, a: 1 };

const DISABLED_VARIANT_RE = /\bState\s*=\s*Disabled\b/i;

function isDisabledVariant(node: FigmaNode): boolean {
  return DISABLED_VARIANT_RE.test(node.name);
}

function isLargeText(node: FigmaNode): boolean {
  const fontSize = node.style?.fontSize;
  if (!fontSize) return false;
  if (fontSize >= LARGE_FONT_SIZE) return true;
  if (fontSize >= LARGE_FONT_SIZE_BOLD) {
    const fontWeight = node.style?.fontWeight;
    if (typeof fontWeight === "number" && fontWeight >= 600) return true;
  }
  return false;
}

function getThreshold(node: FigmaNode): number {
  return isLargeText(node) ? WCAG_AA_LARGE : WCAG_AA_NORMAL;
}

function resolveVariableChain(
  varId: string,
  variables: Record<string, FigmaVariable>,
  visited: Set<string> = new Set(),
): FigmaVariable | null {
  if (visited.has(varId)) return null;
  visited.add(varId);

  const variable = variables[varId];
  if (!variable) return null;

  const values = Object.values(variable.valuesByMode);
  if (values.length === 0) return variable;

  if (typeof values[0] === "object" && values[0] !== null && "type" in values[0]) {
    const alias = values[0] as { type: string; id: string };
    if (alias.type === "VARIABLE_ALIAS") {
      return resolveVariableChain(alias.id, variables, visited);
    }
  }

  return variable;
}

function resolvePaintColor(
  paint: FigmaPaint | undefined,
  context: CheckContext,
): FigmaColor | null {
  if (!paint) return null;
  const color = getSolidFillColor(paint);
  if (!color) return null;

  const boundVar = paint.boundVariables?.color as FigmaBoundVariable | undefined;
  if (!boundVar) return color;

  const resolved = resolveVariableChain(boundVar.id, context.variables);
  if (!resolved) return color;

  const values = Object.values(resolved.valuesByMode);
  if (values.length === 0) return color;

  const value = values[0];
  if (typeof value === "object" && value !== null && "r" in value) {
    return value as FigmaColor;
  }

  return color;
}

function getVariableName(
  paint: FigmaPaint | undefined,
  context: CheckContext,
): string | undefined {
  if (!paint) return undefined;
  const boundVar = paint.boundVariables?.color as FigmaBoundVariable | undefined;
  if (!boundVar) return undefined;

  const variable = context.variables[boundVar.id];
  return variable?.name;
}

function compositeNodeFills(
  fills: FigmaPaint[],
  context: CheckContext,
): { color: FigmaColor | null; varName: string | undefined } {
  let result: FigmaColor | null = null;
  let varName: string | undefined;

  for (let i = 0; i < fills.length; i++) {
    const paint = fills[i] as FigmaPaint;
    if (paint.visible === false) continue;
    const resolvedColor = resolvePaintColor(paint, context);
    if (!resolvedColor) continue;

    const fillAlpha = (paint.opacity ?? 1) * resolvedColor.a;

    if (!result) {
      result = { r: resolvedColor.r, g: resolvedColor.g, b: resolvedColor.b, a: fillAlpha };
    } else {
      result = blendColor(result, resolvedColor, fillAlpha);
    }

    varName = getVariableName(paint, context) ?? varName;
  }

  return { color: result, varName };
}

function getTextFillPaint(node: FigmaNode): FigmaPaint | undefined {
  if (!node.fills || node.fills.length === 0) return undefined;
  for (const fill of node.fills) {
    const paint = fill as FigmaPaint;
    if (paint.type === "SOLID" && paint.visible !== false) return paint;
  }
  return undefined;
}

function checkTextContrast(
  node: FigmaNode,
  nodePath: string,
  bgColor: FigmaColor,
  bgVarName: string | undefined,
  context: CheckContext,
  violations: Violation[],
): number {
  const textPaint = getTextFillPaint(node);
  if (!textPaint) return 0;

  const textColor = resolvePaintColor(textPaint, context);
  if (!textColor) return 0;

  const ratio = contrastRatio(textColor, bgColor);
  const threshold = getThreshold(node);
  if (ratio < threshold) {
    const textVarName = getVariableName(textPaint, context);
    const textHex = colorToHex(textColor);
    const bgHex = colorToHex(bgColor);

    violations.push({
      nodePath,
      property: "fills[0]",
      rawValue: `${ratio}:1 (text: ${textHex}, bg: ${bgHex})`,
      expected: `\u2265${threshold}:1 (WCAG AA${isLargeText(node) ? " large text" : ""})`,
      suggestedReplacement:
        textVarName && bgVarName
          ? `${textVarName} vs ${bgVarName} (ratio: ${ratio}:1)`
          : undefined,
    });
  }

  return 1;
}

function walkTree(
  node: FigmaNode,
  path: string,
  bgColor: FigmaColor,
  bgVarName: string | undefined,
  context: CheckContext,
  violations: Violation[],
): number {
  if (node.visible === false) return 0;

  const nodePath = path ? `${path} > ${node.name}` : node.name;
  let textNodesChecked = 0;

  if (node.type === "COMPONENT_SET") {
    for (const child of node.children ?? []) {
      if (isDisabledVariant(child)) continue;
      textNodesChecked += walkTree(child, nodePath, bgColor, bgVarName, context, violations);
    }
    return textNodesChecked;
  }

  if (node.type === "TEXT") {
    textNodesChecked += checkTextContrast(node, nodePath, bgColor, bgVarName, context, violations);
  }

  let childBg = bgColor;
  let childBgVarName = bgVarName;

  if (node.type !== "TEXT") {
    const fills = node.fills as FigmaPaint[] | undefined;
    const nodeOpacity = node.opacity ?? 1;
    if (fills && fills.length > 0) {
      const composite = compositeNodeFills(fills, context);
      if (composite.color) {
        const effectiveAlpha = composite.color.a * nodeOpacity;
        childBg = blendColor(childBg, composite.color, effectiveAlpha);
        childBgVarName = composite.varName ?? childBgVarName;
      }
    }
  }

  for (const child of node.children ?? []) {
    textNodesChecked += walkTree(child, nodePath, childBg, childBgVarName, context, violations);
  }

  return textNodesChecked;
}

export const accessibilityContrastCheck: ConformanceCheck = {
  id: "accessibility-contrast",
  name: "Accessibility Contrast",
  weight: 0.2,

  async run(context: CheckContext): Promise<CheckResult> {
    const violations: Violation[] = [];

    const totalTextNodes = walkTree(
      context.componentNode,
      "",
      WHITE_BG,
      undefined,
      context,
      violations,
    );

    const score = computeCheckScore(violations.length, totalTextNodes);
    const status = determineStatus(score);

    const summary =
      violations.length > 0
        ? buildSummary("contrast_found", { count: violations.length })
        : buildSummary("contrast_clean");

    return {
      checkId: this.id,
      score,
      status,
      violations,
      summary,
    };
  },
};
