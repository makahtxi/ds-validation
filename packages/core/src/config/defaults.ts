import type { DSValidationConfig } from "../types/config.js";

export const DEFAULT_CHECK_WEIGHTS: Record<string, number> = {
  "hardcoded-colors": 0.25,
  "hardcoded-spacing": 0.15,
  "hardcoded-text-styles": 0.2,
  "no-primitive-tokens": 0.05,
  "state-variables": 0.15,
  "accessibility-contrast": 0.2,
};

export const DEFAULT_CHECK_ENABLED: Record<string, boolean> = {
  "hardcoded-colors": true,
  "hardcoded-spacing": true,
  "hardcoded-text-styles": true,
  "no-primitive-tokens": true,
  "state-variables": true,
  "accessibility-contrast": true,
};

export function resolveConfig(userConfig?: Partial<DSValidationConfig>): {
  checkWeights: Record<string, number>;
  checkOverrides: Record<string, { enabled?: boolean; weight?: number }>;
  classificationOverrides: Record<string, { interactive?: string[]; nonInteractive?: string[] }>;
} {
  const checkWeights: Record<string, number> = { ...DEFAULT_CHECK_WEIGHTS };
  const checkOverrides: Record<string, { enabled?: boolean; weight?: number }> = {};
  const classificationOverrides: Record<string, { interactive?: string[]; nonInteractive?: string[] }> = {};

  if (userConfig?.checks) {
    for (const [checkId, checkConfig] of Object.entries(userConfig.checks)) {
      if (checkConfig.weight !== undefined) {
        checkWeights[checkId] = checkConfig.weight;
      }
      const override: { enabled?: boolean; weight?: number } = {};
      if (checkConfig.enabled !== undefined) {
        override.enabled = checkConfig.enabled;
      }
      if (checkConfig.weight !== undefined) {
        override.weight = checkConfig.weight;
      }
      if (Object.keys(override).length > 0) {
        checkOverrides[checkId] = override;
      }
      if (checkConfig.rules) {
        classificationOverrides[checkId] = checkConfig.rules;
      }
    }
  }

  return { checkWeights, checkOverrides, classificationOverrides };
}

export function resolveCheckOverrides(
  userConfig?: Partial<DSValidationConfig>,
): Record<string, { enabled?: boolean; weight?: number }> {
  const overrides: Record<string, { enabled?: boolean; weight?: number }> = {};
  if (userConfig?.checks) {
    for (const [checkId, checkConfig] of Object.entries(userConfig.checks)) {
      const override: { enabled?: boolean; weight?: number } = {};
      if (checkConfig.enabled !== undefined) {
        override.enabled = checkConfig.enabled;
      }
      if (checkConfig.weight !== undefined) {
        override.weight = checkConfig.weight;
      }
      if (Object.keys(override).length > 0) {
        overrides[checkId] = override;
      }
    }
  }
  return overrides;
}
