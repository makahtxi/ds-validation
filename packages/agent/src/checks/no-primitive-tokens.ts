import type {
  ConformanceCheck,
  CheckContext,
  CheckResult,
  Violation,
  FigmaNode,
  FigmaBoundVariable,
  FigmaPaint,
  FigmaVariable,
  FigmaVariableValue,
} from "@ds-validation/core";
import { computeCheckScore, determineStatus, buildSummary, colorToHex } from "@ds-validation/core";

interface TokenRef {
  nodePath: string;
  property: string;
  varId: string;
}

function collectAllTokenRefs(
  node: FigmaNode,
  path: string,
  refs: TokenRef[],
): void {
  const nodePath = path ? `${path} > ${node.name}` : node.name;

  if (node.type !== "COMPONENT_SET") {
    if (node.boundVariables) {
      for (const [prop, bv] of Object.entries(node.boundVariables)) {
        const boundVar = bv as FigmaBoundVariable;
        refs.push({ nodePath, property: prop, varId: boundVar.id });
      }
    }

    if (node.fills) {
      for (let i = 0; i < node.fills.length; i++) {
        const paint = node.fills[i] as FigmaPaint;
        if (paint.boundVariables) {
          for (const [prop, bv] of Object.entries(paint.boundVariables)) {
            const boundVar = bv as FigmaBoundVariable;
            refs.push({
              nodePath,
              property: `fills[${i}].${prop}`,
              varId: boundVar.id,
            });
          }
        }
      }
    }

    if (node.strokes) {
      for (let i = 0; i < node.strokes.length; i++) {
        const paint = node.strokes[i] as FigmaPaint;
        if (paint.boundVariables) {
          for (const [prop, bv] of Object.entries(paint.boundVariables)) {
            const boundVar = bv as FigmaBoundVariable;
            refs.push({
              nodePath,
              property: `strokes[${i}].${prop}`,
              varId: boundVar.id,
            });
          }
        }
      }
    }

    if (node.styleId) {
      refs.push({ nodePath, property: "styleId", varId: node.styleId });
    }
  }

  for (const child of node.children ?? []) {
    collectAllTokenRefs(child, nodePath, refs);
  }
}

function isAliasValue(value: FigmaVariableValue): boolean {
  return typeof value === "object" && value !== null && "type" in value && value.type === "VARIABLE_ALIAS";
}

function isPrimitiveVariable(variable: FigmaVariable): boolean {
  for (const value of Object.values(variable.valuesByMode)) {
    if (isAliasValue(value)) {
      return false;
    }
  }
  return true;
}

function findSemanticAlternative(
  primitiveVarId: string,
  primitiveName: string,
  variables: Record<string, FigmaVariable>,
): string | null {
  const candidates: Array<{ name: string; specificity: number }> = [];

  for (const variable of Object.values(variables)) {
    for (const value of Object.values(variable.valuesByMode)) {
      if (isAliasValue(value) && (value as { type: string; id: string }).id === primitiveVarId) {
        candidates.push({ name: variable.name, specificity: 0 });

        const primitiveCategory = primitiveName.split("/")[0]?.toLowerCase() ?? "";
        const semanticCategory = variable.name.split("/")[0]?.toLowerCase() ?? "";
        if (primitiveCategory && primitiveCategory === semanticCategory) {
          candidates[candidates.length - 1].specificity += 1;
        }

        const semanticParts = variable.name.split(/[/_\-]/).filter((p) => p.length > 0);
        const primitiveParts = primitiveName.split(/[/_\-]/).filter((p) => p.length > 0);
        if (semanticParts.length > primitiveParts.length) {
          candidates[candidates.length - 1].specificity += 1;
        }
      }
    }
  }

  candidates.sort((a, b) => b.specificity - a.specificity);

  return candidates.length > 0 ? candidates[0].name : null;
}

function getPrimitiveValueDisplay(variable: FigmaVariable): string {
  const values = Object.values(variable.valuesByMode);
  if (values.length === 0) return "unknown value";
  
  const value = values[0];
  if (typeof value === "number") return value.toString();
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "boolean") return value.toString();
  if (typeof value === "object" && value !== null && "r" in value) {
    return colorToHex(value as { r: number; g: number; b: number; a: number });
  }
  return "unknown value";
}

export const noPrimitiveTokensCheck: ConformanceCheck = {
  id: "no-primitive-tokens",
  name: "No Primitive Tokens",
  weight: 0.25,

  async run(context: CheckContext): Promise<CheckResult> {
    const refs: TokenRef[] = [];
    collectAllTokenRefs(context.componentNode, "", refs);

    if (refs.length === 0) {
      return {
        checkId: this.id,
        score: 100,
        status: "pass",
        violations: [],
        summary: buildSummary("primitive_tokens_clean"),
      };
    }

    const uniqueVarIds = [...new Set(refs.map((r) => r.varId))];
    const varIdToName = new Map<string, string>();

    for (const id of uniqueVarIds) {
      const variable = context.variables[id];
      varIdToName.set(id, variable ? variable.name : id);
    }

    const violations: Violation[] = [];
    const primitiveExamples: string[] = [];
    
    for (const ref of refs) {
      const variable = context.variables[ref.varId];
      if (!variable) continue;

      if (isPrimitiveVariable(variable)) {
        const suggestedReplacement = findSemanticAlternative(
          ref.varId,
          variable.name,
          context.variables,
        );
        const primitiveValue = getPrimitiveValueDisplay(variable);
        violations.push({
          nodePath: ref.nodePath,
          property: ref.property,
          rawValue: `${variable.name} (${primitiveValue})`,
          expected: "A semantic/component-level token",
          suggestedReplacement: suggestedReplacement ?? undefined,
        });
        
        if (primitiveExamples.length < 3) {
          primitiveExamples.push(`${variable.name}=${primitiveValue}`);
        }
      }
    }

    const score = computeCheckScore(violations.length, refs.length);
    const status = determineStatus(score);

    let summary;
    if (violations.length > 0) {
      summary = buildSummary("primitive_tokens_found", {
        count: violations.length,
        examples: primitiveExamples.join(", "),
      });
    } else {
      summary = buildSummary("primitive_tokens_clean");
    }

    return {
      checkId: this.id,
      score,
      status,
      violations,
      summary,
    };
  },
};