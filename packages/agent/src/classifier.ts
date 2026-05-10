import type {
  ComponentClassification,
  CheckComponentRules,
  ClassificationOverride,
} from "@ds-validation/core";

export function classifyComponent(
  componentName: string,
  rules: CheckComponentRules,
  overrides?: Record<string, ClassificationOverride>,
): ComponentClassification {
  const normalizedName = componentName.toLowerCase();

  for (const [checkId, override] of Object.entries(overrides ?? {})) {
    if (override.interactive?.some((pattern) => normalizedName.includes(pattern.toLowerCase()))) {
      return "interactive";
    }
    if (override.nonInteractive?.some((pattern) => normalizedName.includes(pattern.toLowerCase()))) {
      return "non-interactive";
    }
  }

  if (rules.interactive.some((pattern) => normalizedName.includes(pattern.toLowerCase()))) {
    return "interactive";
  }

  if (rules.nonInteractive.some((pattern) => normalizedName.includes(pattern.toLowerCase()))) {
    return "non-interactive";
  }

  if (rules.ambiguous.some((pattern) => normalizedName.includes(pattern.toLowerCase()))) {
    return "ambiguous";
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

      const classification = classifyComponent(componentName, check.componentRules, overrides);
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
