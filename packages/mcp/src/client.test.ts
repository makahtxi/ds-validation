import { describe, it, expect } from "vitest";
import { McpVariableClient } from "./client.js";

describe("McpVariableClient", () => {
  it("can be instantiated", () => {
    const client = new McpVariableClient({
      command: "npx",
      args: ["-y", "figma-console-mcp@latest", "--stdio"],
    });
    expect(client).toBeDefined();
  });
});

describe("parseVariablesResult", () => {
  // Access private method via prototype for testing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = new McpVariableClient({ command: "node", args: [] });

  it("handles REST API format: { meta: { variables: { id: var } } }", () => {
    const result = {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            meta: {
              variables: {
                "VariableID:1": {
                  id: "VariableID:1",
                  name: "primary-color",
                  resolvedType: "COLOR",
                  variableCollectionId: "CollectionID:1",
                  valuesByMode: {
                    "ModeID:1": { r: 0.2, g: 0.4, b: 0.8, a: 1 },
                  },
                },
                "VariableID:2": {
                  id: "VariableID:2",
                  name: "spacing-md",
                  resolvedType: "FLOAT",
                  variableCollectionId: "CollectionID:1",
                  valuesByMode: {
                    "ModeID:1": 16,
                  },
                },
              },
            },
          }),
        },
      ],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const variables = (client as any).parseVariablesResult(result);
    expect(Object.keys(variables).length).toBe(2);
    expect(variables["VariableID:1"].name).toBe("primary-color");
    expect(variables["VariableID:1"].resolvedType).toBe("COLOR");
    expect(variables["VariableID:2"].name).toBe("spacing-md");
    expect(variables["VariableID:2"].resolvedType).toBe("FLOAT");
  });

  it("handles array format: { variables: [...] }", () => {
    const result = {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            variables: [
              {
                id: "var-1",
                name: "bg-color",
                resolvedType: "COLOR",
                variableCollectionId: "col-1",
                valuesByMode: { "m1": { r: 1, g: 1, b: 1, a: 1 } },
              },
            ],
          }),
        },
      ],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const variables = (client as any).parseVariablesResult(result);
    expect(Object.keys(variables).length).toBe(1);
    expect(variables["var-1"].name).toBe("bg-color");
  });

  it("handles plain JSON array of variables", () => {
    const result = {
      content: [
        {
          type: "text",
          text: JSON.stringify([
            {
              id: "v1",
              name: "color-red",
              resolvedType: "COLOR",
              variableCollectionId: "c1",
              valuesByMode: { "m1": { r: 1, g: 0, b: 0, a: 1 } },
            },
            {
              id: "v2",
              name: "spacing-lg",
              resolvedType: "FLOAT",
              variableCollectionId: "c2",
              valuesByMode: { "m1": 24 },
            },
          ]),
        },
      ],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const variables = (client as any).parseVariablesResult(result);
    expect(Object.keys(variables).length).toBe(2);
    expect(variables["v1"].name).toBe("color-red");
    expect(variables["v2"].name).toBe("spacing-lg");
  });

  it("handles object keyed by ID", () => {
    const result = {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            "VariableID:abc": {
              id: "VariableID:abc",
              name: "font-size-sm",
              resolvedType: "FLOAT",
              variableCollectionId: "CollectionID:1",
              valuesByMode: { "ModeID:1": 12 },
            },
          }),
        },
      ],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const variables = (client as any).parseVariablesResult(result);
    expect(Object.keys(variables).length).toBe(1);
    expect(variables["VariableID:abc"].name).toBe("font-size-sm");
  });

  it("handles collections with variables format", () => {
    const result = {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            collections: [{ id: "c1", name: "Theme" }],
            variables: [
              {
                id: "v1",
                name: "brand-blue",
                resolvedType: "COLOR",
                variableCollectionId: "c1",
                valuesByMode: { "m1": { r: 0, g: 0.4, b: 0.8, a: 1 } },
              },
            ],
          }),
        },
      ],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const variables = (client as any).parseVariablesResult(result);
    expect(Object.keys(variables).length).toBe(1);
    expect(variables["v1"].name).toBe("brand-blue");
  });

  it("handles VARIABLE_ALIAS in valuesByMode", () => {
    const result = {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            variables: [
              {
                id: "v1",
                name: "button-bg",
                resolvedType: "COLOR",
                variableCollectionId: "c1",
                valuesByMode: {
                  "m1": { type: "VARIABLE_ALIAS", id: "VariableID:primary" },
                },
              },
            ],
          }),
        },
      ],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const variables = (client as any).parseVariablesResult(result);
    expect(variables["v1"].valuesByMode["m1"]).toEqual({
      type: "VARIABLE_ALIAS",
      id: "VariableID:primary",
    });
  });

  it("returns empty for empty content", () => {
    const result = { content: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const variables = (client as any).parseVariablesResult(result);
    expect(Object.keys(variables).length).toBe(0);
  });

  it("handles multiple content items, using first valid one", () => {
    const result = {
      content: [
        {
          type: "text",
          text: "No variables found in this context",
        },
        {
          type: "text",
          text: JSON.stringify({
            variables: [
              {
                id: "v1",
                name: "test-var",
                resolvedType: "STRING",
                variableCollectionId: "c1",
                valuesByMode: { "m1": "hello" },
              },
            ],
          }),
        },
      ],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const variables = (client as any).parseVariablesResult(result);
    expect(Object.keys(variables).length).toBe(1);
    expect(variables["v1"].name).toBe("test-var");
  });
});