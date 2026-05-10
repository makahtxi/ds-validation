import type {
  ComponentClassification,
  CheckComponentRules,
  ClassificationOverride,
} from "@ds-validation/core";

// Splits component names into tokens for exact word matching.
// e.g. "PrimaryButton" → ["primary", "button"], "dialog-modal" → ["dialog", "modal"].
// Patterns in componentRules are matched against individual tokens (not substring),
// so "button" matches "Primary Button" but not "Buttons".
function tokenize(componentName: string): string[] {
  return componentName
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .split(" ");
}

export function classifyComponent(
  componentName: string,
  rules: CheckComponentRules,
  override?: ClassificationOverride,
): ComponentClassification {
  const tokens = tokenize(componentName);

  if (override) {
    if (override.interactive?.some((pattern) => tokens.includes(pattern.toLowerCase()))) {
      return "interactive";
    }
    if (override.nonInteractive?.some((pattern) => tokens.includes(pattern.toLowerCase()))) {
      return "non-interactive";
    }
  }

  if (rules.interactive.some((pattern) => tokens.includes(pattern.toLowerCase()))) {
    return "interactive";
  }

  if (rules.nonInteractive.some((pattern) => tokens.includes(pattern.toLowerCase()))) {
    return "non-interactive";
  }

  return "ambiguous";
}

export interface AmbiguousComponent {
  componentName: string;
  checkId: string;
  checkName: string;
}

export function collectAmbiguousComponents(
  componentNames: string[],
  checks: Array<{ id: string; name: string; componentRules?: CheckComponentRules }>,
  savedDecisions: Record<string, ComponentClassification>,
  overrides?: Record<string, ClassificationOverride>,
): AmbiguousComponent[] {
  const ambiguous: AmbiguousComponent[] = [];

  for (const componentName of componentNames) {
    for (const check of checks) {
      if (!check.componentRules) continue;

      const decisionKey = `${componentName}:${check.id}`;
      if (savedDecisions[decisionKey]) continue;

      const classification = classifyComponent(componentName, check.componentRules, overrides?.[check.id]);
      if (classification === "ambiguous") {
        ambiguous.push({
          componentName,
          checkId: check.id,
          checkName: check.name,
        });
      }
    }
  }

  return ambiguous;
}