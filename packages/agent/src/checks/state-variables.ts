import type {
  ConformanceCheck,
  CheckContext,
  CheckResult,
  Violation,
  FigmaComponentPropertyDefinition,
  CheckComponentRules,
} from "@ds-validation/core";
import { determineStatus, buildSummary } from "@ds-validation/core";

const REQUIRED_STATES = ["Default", "Hover", "Selected", "Disabled", "Focused"] as const;

const DEFAULT_COMPONENT_RULES: CheckComponentRules = {
  interactive: [
    "button",
    "input",
    "select",
    "checkbox",
    "toggle",
    "link",
    "tab",
    "dropdown",
    "slider",
    "switch",
    "radio",
    "search",
    "textarea",
    "combobox",
    "autocomplete",
    "stepper",
    "pagination",
  ],
  nonInteractive: [
    "icon",
    "text",
    "label",
    "divider",
    "avatar",
    "badge",
    "logo",
    "heading",
    "paragraph",
    "caption",
    "spacer",
    "separator",
    "image",
    "illustration",
  ],
  ambiguous: [
    "card",
    "modal",
    "dialog",
    "tooltip",
    "popover",
    "menu",
    "alert",
    "banner",
    "chip",
    "tag",
    "accordion",
    "list",
    "table",
    "navigation",
    "sidebar",
    "breadcrumb",
  ],
};

export const stateVariablesCheck: ConformanceCheck = {
  id: "state-variables",
  name: "State Variables Available",
  weight: 0.15,
  componentRules: DEFAULT_COMPONENT_RULES,

  async run(context: CheckContext): Promise<CheckResult> {
    const node = context.componentNode;
    const violations: Violation[] = [];
    const foundStates: string[] = [];

    const propDefs = node.componentPropertyDefinitions ?? {};

    for (const [propName, propDef] of Object.entries(propDefs)) {
      const def = propDef as FigmaComponentPropertyDefinition;

      // Check variant options for state values
      if (def.type === "VARIANT" && def.variantOptions) {
        for (const option of def.variantOptions) {
          const normalizedOption = option.trim().toLowerCase();
          for (const state of REQUIRED_STATES) {
            if (normalizedOption === state.toLowerCase()) {
              if (!foundStates.includes(state)) {
                foundStates.push(state);
              }
            }
          }
        }
      }

      // Check boolean properties that represent states
      const normalizedProp = propName.trim().toLowerCase();
      for (const state of REQUIRED_STATES) {
        if (
          normalizedProp === state.toLowerCase() ||
          normalizedProp === `${state.toLowerCase()}` ||
          normalizedProp.includes(state.toLowerCase())
        ) {
          if (!foundStates.includes(state)) {
            foundStates.push(state);
          }
        }
      }

      // Check property name itself for variant properties with state-like names
      if (def.type === "VARIANT") {
        const normalizedProp2 = propName.trim().toLowerCase();
        if (
          normalizedProp2 === "state" ||
          normalizedProp2 === "variant" ||
          normalizedProp2 === "status"
        ) {
          if (def.variantOptions) {
            for (const option of def.variantOptions) {
              const normalized = option.trim().toLowerCase();
              for (const state of REQUIRED_STATES) {
                if (normalized === state.toLowerCase()) {
                  if (!foundStates.includes(state)) {
                    foundStates.push(state);
                  }
                }
              }
            }
          }
        }
      }
    }

    // Determine missing states
    const missingStates = REQUIRED_STATES.filter(
      (s) => !foundStates.includes(s),
    );

    for (const state of missingStates) {
      violations.push({
        nodePath: node.name,
        property: "componentPropertyDefinitions",
        rawValue: `Missing: ${state}`,
        expected: `State variant for "${state}"`,
      });
    }

    const score = Math.round((foundStates.length / REQUIRED_STATES.length) * 100);
    const status = determineStatus(score);

    const summary =
      foundStates.length === REQUIRED_STATES.length
        ? buildSummary("state_variables_complete")
        : buildSummary("state_variables_partial", {
            found: foundStates.length,
            total: REQUIRED_STATES.length,
          });

    return {
      checkId: this.id,
      score,
      status,
      violations,
      summary,
    };
  },
};