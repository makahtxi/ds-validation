import { describe, it, expect } from "vitest";
import type { FigmaNode } from "@ds-validation/core";
import { FigmaClient, findComponents } from "./client";

describe("FigmaClient", () => {
  it("can be instantiated with PAT (default)", () => {
    const client = new FigmaClient("test-token");
    expect(client).toBeDefined();
  });

  it("can be instantiated with OAuth token type", () => {
    const client = new FigmaClient("test-token", "oauth");
    expect(client).toBeDefined();
  });
});

function node(partial: Partial<FigmaNode>): FigmaNode {
  return {
    id: partial.id ?? "x",
    name: partial.name ?? "node",
    type: partial.type ?? "FRAME",
    ...partial,
  } as FigmaNode;
}

describe("findComponents", () => {
  it("includes plain COMPONENT nodes", () => {
    const page = node({
      type: "CANVAS",
      name: "Page",
      children: [node({ id: "c1", name: "Button", type: "COMPONENT", children: [] })],
    });
    const result: FigmaNode[] = [];
    findComponents(page, result);
    expect(result.map((n) => n.id)).toEqual(["c1"]);
  });

  it("excludes top-level INSTANCE nodes (usages, not definitions)", () => {
    const page = node({
      type: "CANVAS",
      name: "Page",
      children: [
        node({ id: "i1", name: "Button instance", type: "INSTANCE", children: [] }),
        node({ id: "c1", name: "Button", type: "COMPONENT", children: [] }),
      ],
    });
    const result: FigmaNode[] = [];
    findComponents(page, result);
    expect(result.map((n) => n.id)).toEqual(["c1"]);
  });

  it("returns a COMPONENT_SET as a single entry and does not split out its variants", () => {
    const componentSet = node({
      id: "set1",
      name: "Button",
      type: "COMPONENT_SET",
      children: [
        node({ id: "v1", name: "Variant=Primary", type: "COMPONENT", children: [] }),
        node({ id: "v2", name: "Variant=Secondary", type: "COMPONENT", children: [] }),
      ],
    });
    const page = node({ type: "CANVAS", name: "Page", children: [componentSet] });
    const result: FigmaNode[] = [];
    findComponents(page, result);
    // One entry (the set); variants are carried inside it, not as separate entries.
    expect(result.map((n) => n.id)).toEqual(["set1"]);
    expect(result[0].children).toHaveLength(2);
  });
});
