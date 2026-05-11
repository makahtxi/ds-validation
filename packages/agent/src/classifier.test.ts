import { describe, it, expect } from "vitest";
import { classifyComponent, collectAmbiguousComponents } from "./classifier";
import type { CheckComponentRules } from "@ds-validation/core";

const rules: CheckComponentRules = {
  interactive: ["button", "input", "select"],
  nonInteractive: ["icon", "text", "divider"],
};

describe("classifyComponent", () => {
  it("classifies known interactive components by token match", () => {
    expect(classifyComponent("Button", rules)).toBe("interactive");
    expect(classifyComponent("Primary Button", rules)).toBe("interactive");
    expect(classifyComponent("TextInput", rules)).toBe("interactive");
    expect(classifyComponent("select-box", rules)).toBe("interactive");
  });

  it("classifies known non-interactive components by token match", () => {
    expect(classifyComponent("Icon", rules)).toBe("non-interactive");
    expect(classifyComponent("Text", rules)).toBe("non-interactive");
    expect(classifyComponent("small-divider", rules)).toBe("non-interactive");
  });

  it("returns ambiguous for unmatched components", () => {
    expect(classifyComponent("Card", rules)).toBe("ambiguous");
    expect(classifyComponent("Modal", rules)).toBe("ambiguous");
    expect(classifyComponent("UnknownComponent", rules)).toBe("ambiguous");
  });

  it("always returns ambiguous when rules are empty", () => {
    expect(classifyComponent("Button", { interactive: [], nonInteractive: [] })).toBe("ambiguous");
  });

  it("prevents false positives via token-based matching", () => {
    expect(classifyComponent("Buttons", rules)).toBe("ambiguous");
    expect(classifyComponent("Icons", rules)).toBe("ambiguous");
    expect(classifyComponent("Divider", rules)).toBe("non-interactive");
    expect(classifyComponent("InputLabel", rules)).toBe("interactive");
  });

  it("is case-insensitive", () => {
    expect(classifyComponent("BUTTON", rules)).toBe("interactive");
    expect(classifyComponent("ICON", rules)).toBe("non-interactive");
    expect(classifyComponent("SELECT", rules)).toBe("interactive");
  });

  it("handles camelCase tokenization", () => {
    expect(classifyComponent("TextInput", rules)).toBe("interactive");
    expect(classifyComponent("PrimaryButton", rules)).toBe("interactive");
    expect(classifyComponent("SmallIcon", rules)).toBe("non-interactive");
    expect(classifyComponent("HeaderText", rules)).toBe("non-interactive");
  });

  it("handles hyphenated names", () => {
    expect(classifyComponent("text-input", rules)).toBe("interactive");
    expect(classifyComponent("icon-button", rules)).toBe("interactive");
    expect(classifyComponent("dialog-modal", rules)).toBe("ambiguous");
  });

  it("handles underscore names", () => {
    expect(classifyComponent("primary_button", rules)).toBe("interactive");
    expect(classifyComponent("small_icon", rules)).toBe("non-interactive");
  });

  it("handles slash-delimited names", () => {
    expect(classifyComponent("form/input", rules)).toBe("interactive");
    expect(classifyComponent("star/icon", rules)).toBe("non-interactive");
  });

  it("prioritizes interactive over non-interactive when both match", () => {
    const mixedRules: CheckComponentRules = {
      interactive: ["icon"],
      nonInteractive: ["icon"],
    };
    expect(classifyComponent("icon", mixedRules)).toBe("interactive");
  });

  it("overrides take precedence over default rules", () => {
    const override: CheckComponentRules = {
      interactive: ["dialog"],
      nonInteractive: [],
    };
    expect(classifyComponent("Dialog", override)).toBe("interactive");
    expect(classifyComponent("Dialog", rules)).toBe("ambiguous");
  });
});

describe("collectAmbiguousComponents", () => {
  const checks = [
    { id: "state-variables", name: "State Variables", componentRules: rules },
    { id: "another-check", name: "Another Check", componentRules: rules },
    { id: "no-rules", name: "No Rules" },
  ];

  it("returns empty array and auto-classified when no ambiguous components exist", () => {
    const result = collectAmbiguousComponents(["Button", "Icon"], checks, {});
    expect(result.ambiguous).toEqual([]);
    expect(result.autoClassified["Button:state-variables"]).toBe("interactive");
    expect(result.autoClassified["Icon:state-variables"]).toBe("non-interactive");
    expect(result.autoClassified["Button:another-check"]).toBe("interactive");
    expect(result.autoClassified["Icon:another-check"]).toBe("non-interactive");
  });

  it("collects components that are ambiguous for any check", () => {
    const result = collectAmbiguousComponents(["Card", "Button"], checks, {});
    expect(result.ambiguous).toHaveLength(2);
    expect(result.ambiguous.map((r) => r.componentName)).toEqual(["Card", "Card"]);
    expect(result.ambiguous.map((r) => r.checkId)).toEqual(["state-variables", "another-check"]);
    expect(result.autoClassified["Button:state-variables"]).toBe("interactive");
  });

  it("skips checks without componentRules", () => {
    const result = collectAmbiguousComponents(["Card"], [{ id: "no-rules", name: "No Rules" }], {});
    expect(result.ambiguous).toEqual([]);
    expect(result.autoClassified).toEqual({});
  });

  it("skips components with saved decisions", () => {
    const savedDecisions = { "Card:state-variables": "interactive" as const };
    const result = collectAmbiguousComponents(["Card", "Button"], checks, savedDecisions);
    expect(result.ambiguous).toHaveLength(1);
    expect(result.ambiguous[0]).toEqual({
      componentName: "Card",
      checkId: "another-check",
      checkName: "Another Check",
    });
    expect(result.autoClassified["Button:state-variables"]).toBe("interactive");
    expect(result.autoClassified["Button:another-check"]).toBe("interactive");
  });
});
