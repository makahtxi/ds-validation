import { describe, it, expect } from "vitest";
import type { FigmaNode } from "@ds-validation/core";
import "./register-checks.js"; // side-effect: populates the check registry
import { auditComponent } from "./orchestrator";

function node(partial: Partial<FigmaNode>): FigmaNode {
  return {
    id: partial.id ?? "x",
    name: partial.name ?? "node",
    type: partial.type ?? "FRAME",
    ...partial,
  } as FigmaNode;
}

/** A node with a hardcoded SOLID fill (no styleId / boundVariables) → color violation. */
function hardcodedFillNode(id: string, name: string, color: { r: number; g: number; b: number }): FigmaNode {
  return node({
    id,
    name,
    type: "TEXT",
    characters: "Label",
    fills: [{ type: "SOLID", color: { ...color, a: 1 } }] as FigmaNode["fills"],
  });
}

describe("auditComponent — single-pass walker (walkAllChecks)", () => {
  it("walks into every variant of a COMPONENT_SET", async () => {
    const componentSet = node({
      id: "set1",
      name: "Button",
      type: "COMPONENT_SET",
      children: [
        node({
          id: "v1",
          name: "Variant=Primary",
          type: "COMPONENT",
          children: [hardcodedFillNode("t1", "PrimaryLabel", { r: 0.8, g: 0.8, b: 0.8 })],
        }),
        node({
          id: "v2",
          name: "Variant=Secondary",
          type: "COMPONENT",
          children: [hardcodedFillNode("t2", "SecondaryLabel", { r: 0.8, g: 0.8, b: 0.8 })],
        }),
      ],
    });

    const result = await auditComponent("Button", componentSet, "Page", {}, {});
    const colorPaths = result.checkResults["hardcoded-colors"].violations.map((v) => v.nodePath);

    // Both variants must have been visited.
    expect(colorPaths.some((p) => p.includes("Variant=Primary"))).toBe(true);
    expect(colorPaths.some((p) => p.includes("Variant=Secondary"))).toBe(true);
  });

  it("skips contrast for disabled variants but still runs other checks on them", async () => {
    const componentSet = node({
      id: "set1",
      name: "Button",
      type: "COMPONENT_SET",
      children: [
        node({
          id: "v1",
          name: "Variant=Primary",
          type: "COMPONENT",
          children: [hardcodedFillNode("t1", "PrimaryLabel", { r: 0.8, g: 0.8, b: 0.8 })],
        }),
        node({
          id: "v2",
          name: "State=Disabled",
          type: "COMPONENT",
          children: [hardcodedFillNode("t2", "DisabledLabel", { r: 0.8, g: 0.8, b: 0.8 })],
        }),
      ],
    });

    const result = await auditComponent("Button", componentSet, "Page", {}, {});

    const contrastPaths = result.checkResults["accessibility-contrast"].violations.map((v) => v.nodePath);
    const colorPaths = result.checkResults["hardcoded-colors"].violations.map((v) => v.nodePath);

    // Contrast runs on the enabled variant…
    expect(contrastPaths.some((p) => p.includes("Variant=Primary"))).toBe(true);
    // …but is skipped on the disabled variant.
    expect(contrastPaths.some((p) => p.includes("State=Disabled"))).toBe(false);

    // Color check still runs on the disabled variant (only contrast is skipped).
    expect(colorPaths.some((p) => p.includes("State=Disabled"))).toBe(true);
  });
});
