import { describe, it, expect } from "vitest";
import { hardcodedColorsCheck } from "./hardcoded-colors";
import { hardcodedSpacingCheck } from "./hardcoded-spacing";
import { hardcodedTextStylesCheck } from "./hardcoded-text-styles";
import { stateVariablesCheck } from "./state-variables";
import { noPrimitiveTokensCheck } from "./no-primitive-tokens";
import type { CheckContext, FigmaNode, FigmaVariable } from "@ds-validation/core";

function makeContext(node: Partial<FigmaNode>): CheckContext {
  return {
    componentNode: node as FigmaNode,
    styles: {},
    variables: {},
  };
}

describe("hardcodedColorsCheck", () => {
  it("should pass when all fills have styleId", async () => {
    const context = makeContext({
      id: "1",
      name: "Button",
      type: "COMPONENT",
      fills: [
        { type: "SOLID", color: { r: 0, g: 0, b: 1, a: 1 }, styleId: "style-1" },
      ],
      children: [],
    });

    const result = await hardcodedColorsCheck.run(context);
    expect(result.score).toBe(100);
    expect(result.violations).toHaveLength(0);
  });

  it("should fail when fills have no styleId or boundVariables", async () => {
    const context = makeContext({
      id: "1",
      name: "Button",
      type: "COMPONENT",
      fills: [
        { type: "SOLID", color: { r: 1, g: 0, b: 0, a: 1 } },
      ],
      children: [],
    });

    const result = await hardcodedColorsCheck.run(context);
    expect(result.score).toBe(0);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].property).toBe("fills[0]");
  });

  it("should check nested children", async () => {
    const context = makeContext({
      id: "1",
      name: "Button",
      type: "COMPONENT",
      fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 1, a: 1 }, styleId: "style-1" }],
      children: [
        {
          id: "2",
          name: "Icon",
          type: "FRAME",
          fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0, a: 1 } }],
          children: [],
        },
      ],
    });

    const result = await hardcodedColorsCheck.run(context);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].nodePath).toContain("Icon");
  });

  it("should skip COMPONENT_SET own properties but check children", async () => {
    const context = makeContext({
      id: "1",
      name: "Button",
      type: "COMPONENT_SET",
      fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0, a: 1 } }],
      children: [
        {
          id: "2",
          name: "Variant/Default",
          type: "COMPONENT",
          fills: [{ type: "SOLID", color: { r: 0, g: 1, b: 0, a: 1 } }],
          children: [],
        },
      ],
    });

    const result = await hardcodedColorsCheck.run(context);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].nodePath).toContain("Variant/Default");
  });
});

describe("hardcodedSpacingCheck", () => {
  it("should pass when spacing properties have boundVariables", async () => {
    const context = makeContext({
      id: "1",
      name: "Button",
      type: "COMPONENT",
      paddingLeft: 16,
      paddingRight: 16,
      boundVariables: {
        paddingLeft: { id: "var-1", type: "VARIABLE" },
        paddingRight: { id: "var-2", type: "VARIABLE" },
      },
      children: [],
    });

    const result = await hardcodedSpacingCheck.run(context);
    expect(result.violations).toHaveLength(0);
  });

  it("should fail when spacing has no boundVariables", async () => {
    const context = makeContext({
      id: "1",
      name: "Button",
      type: "COMPONENT",
      paddingLeft: 16,
      children: [],
    });

    const result = await hardcodedSpacingCheck.run(context);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].property).toBe("paddingLeft");
  });

  it("should ignore zero values", async () => {
    const context = makeContext({
      id: "1",
      name: "Button",
      type: "COMPONENT",
      paddingLeft: 0,
      children: [],
    });

    const result = await hardcodedSpacingCheck.run(context);
    expect(result.violations).toHaveLength(0);
  });

  it("should skip COMPONENT_SET own spacing but check children", async () => {
    const context = makeContext({
      id: "1",
      name: "Button",
      type: "COMPONENT_SET",
      paddingLeft: 16,
      children: [
        {
          id: "2",
          name: "Variant/Default",
          type: "COMPONENT",
          paddingLeft: 16,
          children: [],
        },
      ],
    });

    const result = await hardcodedSpacingCheck.run(context);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].nodePath).toContain("Variant/Default");
  });
});

describe("hardcodedTextStylesCheck", () => {
  it("should pass when text node has styleId", async () => {
    const context = makeContext({
      id: "1",
      name: "Label",
      type: "TEXT",
      styleId: "text-style-1",
      children: [],
    });

    const result = await hardcodedTextStylesCheck.run(context);
    expect(result.score).toBe(100);
    expect(result.violations).toHaveLength(0);
  });

  it("should fail for text node without styleId or boundVariables", async () => {
    const context = makeContext({
      id: "1",
      name: "Label",
      type: "TEXT",
      style: { fontFamily: "Inter", fontSize: 14 },
      children: [],
    });

    const result = await hardcodedTextStylesCheck.run(context);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it("should accept AUTO lineHeight", async () => {
    const context = makeContext({
      id: "1",
      name: "Label",
      type: "TEXT",
      style: { fontFamily: "Inter", fontSize: 14, lineHeightUnit: "AUTO" },
      boundVariables: {
        fontFamily: { id: "var-1", type: "VARIABLE" },
        fontSize: { id: "var-2", type: "VARIABLE" },
      },
      children: [],
    });

    const result = await hardcodedTextStylesCheck.run(context);
    const lineHeightViolations = result.violations.filter(
      (v) => v.property === "lineHeight",
    );
    expect(lineHeightViolations).toHaveLength(0);
  });
});

describe("stateVariablesCheck", () => {
  it("should pass when all 5 states are present", async () => {
    const context = makeContext({
      id: "1",
      name: "Button",
      type: "COMPONENT",
      componentPropertyDefinitions: {
        State: {
          type: "VARIANT",
          variantOptions: ["Default", "Hover", "Selected", "Disabled", "Focused"],
        },
      },
      children: [],
    });

    const result = await stateVariablesCheck.run(context);
    expect(result.score).toBe(100);
    expect(result.violations).toHaveLength(0);
  });

  it("should report missing states", async () => {
    const context = makeContext({
      id: "1",
      name: "Button",
      type: "COMPONENT",
      componentPropertyDefinitions: {
        State: {
          type: "VARIANT",
          variantOptions: ["Default", "Hover"],
        },
      },
      children: [],
    });

    const result = await stateVariablesCheck.run(context);
    expect(result.score).toBe(40);
    expect(result.violations).toHaveLength(3);
  });
});

describe("noPrimitiveTokensCheck", () => {
  it("should pass when no tokens are referenced", async () => {
    const context = makeContext({
      id: "1",
      name: "Button",
      type: "COMPONENT",
      fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0, a: 1 } }],
      children: [],
    });

    const result = await noPrimitiveTokensCheck.run(context);
    expect(result.score).toBe(100);
    expect(result.violations).toHaveLength(0);
  });

  it("should pass when referenced token is a VARIABLE_ALIAS (semantic)", async () => {
    const variables: Record<string, FigmaVariable> = {
      "var-semantic": {
        id: "var-semantic",
        name: "color/action-primary",
        variableCollectionId: "col-1",
        resolvedType: "COLOR",
        valuesByMode: {
          "mode-1": { type: "VARIABLE_ALIAS", id: "var-primitive" },
        },
      },
      "var-primitive": {
        id: "var-primitive",
        name: "color/red-500",
        variableCollectionId: "col-1",
        resolvedType: "COLOR",
        valuesByMode: {
          "mode-1": { r: 0.93, g: 0.27, b: 0.27, a: 1 },
        },
      },
    };

    const context: CheckContext = {
      componentNode: {
        id: "1",
        name: "Button",
        type: "COMPONENT",
        fills: [
          {
            type: "SOLID",
            boundVariables: { color: { id: "var-semantic", type: "VARIABLE" } },
          },
        ],
        children: [],
      } as FigmaNode,
      styles: {},
      variables,
    };

    const result = await noPrimitiveTokensCheck.run(context);
    expect(result.violations).toHaveLength(0);
  });

  it("should flag when a primitive token (raw value) is referenced directly", async () => {
    const variables: Record<string, FigmaVariable> = {
      "var-raw": {
        id: "var-raw",
        name: "color/red-500",
        variableCollectionId: "col-1",
        resolvedType: "COLOR",
        valuesByMode: { "mode-1": { r: 0.93, g: 0.27, b: 0.27, a: 1 } },
      },
    };

    const context: CheckContext = {
      componentNode: {
        id: "1",
        name: "Button",
        type: "COMPONENT",
        fills: [
          {
            type: "SOLID",
            boundVariables: { color: { id: "var-raw", type: "VARIABLE" } },
          },
        ],
        children: [],
      } as FigmaNode,
      styles: {},
      variables,
    };

    const result = await noPrimitiveTokensCheck.run(context);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].rawValue).toContain("color/red-500");
  });

  it("should suggest a semantic alternative when one exists", async () => {
    const variables: Record<string, FigmaVariable> = {
      "var-primitive": {
        id: "var-primitive",
        name: "color/red-500",
        variableCollectionId: "col-1",
        resolvedType: "COLOR",
        valuesByMode: { "mode-1": { r: 0.93, g: 0.27, b: 0.27, a: 1 } },
      },
      "var-semantic": {
        id: "var-semantic",
        name: "color/action-primary",
        variableCollectionId: "col-1",
        resolvedType: "COLOR",
        valuesByMode: {
          "mode-1": { type: "VARIABLE_ALIAS", id: "var-primitive" },
        },
      },
    };

    const context: CheckContext = {
      componentNode: {
        id: "1",
        name: "Button",
        type: "COMPONENT",
        fills: [
          {
            type: "SOLID",
            boundVariables: { color: { id: "var-primitive", type: "VARIABLE" } },
          },
        ],
        children: [],
      } as FigmaNode,
      styles: {},
      variables,
    };

    const result = await noPrimitiveTokensCheck.run(context);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].rawValue).toContain("color/red-500");
    expect(result.violations[0].suggestedReplacement).toBe("color/action-primary");
  });

  it("should pass when a spacing variable is a VARIABLE_ALIAS", async () => {
    const variables: Record<string, FigmaVariable> = {
      "var-spacing-1": {
        id: "var-spacing-1",
        name: "Spacing/spacing-1",
        variableCollectionId: "col-1",
        resolvedType: "FLOAT",
        valuesByMode: {
          "mode-1": { type: "VARIABLE_ALIAS", id: "var-number-4" },
        },
      },
      "var-number-4": {
        id: "var-number-4",
        name: "Number/4",
        variableCollectionId: "col-1",
        resolvedType: "FLOAT",
        valuesByMode: { "mode-1": 4 },
      },
    };

    const context: CheckContext = {
      componentNode: {
        id: "1",
        name: "Button",
        type: "COMPONENT",
        paddingLeft: 4,
        boundVariables: { paddingLeft: { id: "var-spacing-1", type: "VARIABLE" } },
        children: [],
      } as FigmaNode,
      styles: {},
      variables,
    };

    const result = await noPrimitiveTokensCheck.run(context);
    expect(result.violations).toHaveLength(0);
  });

  it("should skip COMPONENT_SET own boundVariables but check children", async () => {
    const variables: Record<string, FigmaVariable> = {
      "var-raw": {
        id: "var-raw",
        name: "color/red-500",
        variableCollectionId: "col-1",
        resolvedType: "COLOR",
        valuesByMode: { "mode-1": { r: 0.93, g: 0.27, b: 0.27, a: 1 } },
      },
    };

    const context: CheckContext = {
      componentNode: {
        id: "1",
        name: "Button",
        type: "COMPONENT_SET",
        fills: [
          {
            type: "SOLID",
            boundVariables: { color: { id: "var-raw", type: "VARIABLE" } },
          },
        ],
        children: [
          {
            id: "2",
            name: "Variant/Default",
            type: "COMPONENT",
            fills: [
              {
                type: "SOLID",
                boundVariables: { color: { id: "var-raw", type: "VARIABLE" } },
              },
            ],
            children: [],
          } as FigmaNode,
        ],
      } as FigmaNode,
      styles: {},
      variables,
    };

    const result = await noPrimitiveTokensCheck.run(context);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].nodePath).toContain("Variant/Default");
  });
});