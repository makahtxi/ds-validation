import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { FigmaVariable, FigmaColor, FigmaVariableValue } from "@ds-validation/core";

export interface McpClientConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  figmaApiKey?: string;
  debug?: boolean;
}

interface McpVariableValue {
  r?: number;
  g?: number;
  b?: number;
  a?: number;
  type?: string;
  id?: string;
}

interface McpVariable {
  id: string;
  name: string;
  resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  variableCollectionId?: string;
  valuesByMode: Record<string, McpVariableValue | number | string | boolean>;
  description?: string;
  isAlias?: boolean;
  aliasFrom?: string;
}

function mapMcpVariableValue(raw: McpVariableValue | number | string | boolean): FigmaVariableValue {
  if (typeof raw === "number" || typeof raw === "string" || typeof raw === "boolean") {
    return raw;
  }
  if (typeof raw === "object" && raw !== null) {
    if (raw.type === "VARIABLE_ALIAS" && raw.id) {
      return { type: "VARIABLE_ALIAS", id: raw.id as string };
    }
    if (typeof raw.r === "number" && typeof raw.g === "number" && typeof raw.b === "number") {
      const colorObj: FigmaColor = {
        r: raw.r as number,
        g: raw.g as number,
        b: raw.b as number,
        a: (raw.a as number) ?? 1,
      };
      return colorObj;
    }
  }
  return String(raw);
}

function debugLog(msg: string, data?: unknown) {
  if (process.env.DS_VALIDATION_DEBUG === "1" || process.env.DS_VALIDATION_DEBUG === "true") {
    console.error(`[ds-validation:mcp] ${msg}`, data !== undefined ? JSON.stringify(data, null, 2) : "");
  }
}

export class McpVariableClient {
  private config: McpClientConfig;

  constructor(config: McpClientConfig) {
    this.config = config;
  }

  async getVariables(fileUrl: string): Promise<Record<string, FigmaVariable>> {
    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      ...this.config.env,
    };
    if (this.config.figmaApiKey) {
      env.FIGMA_ACCESS_TOKEN = this.config.figmaApiKey;
    }

    debugLog("Starting MCP client", { command: this.config.command, args: this.config.args, fileUrl });

    const transport = new StdioClientTransport({
      command: this.config.command,
      args: this.config.args,
      env,
    });

    const client = new Client({
      name: "ds-validation",
      version: "0.0.1",
    });

    try {
      await client.connect(transport);
      debugLog("MCP client connected to MCP server");

      // Wait for MCP server to initialize and connect to Figma Desktop Bridge
      // The server needs time to start up, connect to Figma Desktop via WebSocket,
      // and have the Desktop Bridge plugin connect back
      debugLog("Waiting for MCP server to initialize...");
      await new Promise((resolve) => setTimeout(resolve, 2000));

      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const status: any = await client.callTool({
            name: "figma_get_status",
            arguments: {},
          });
          const statusText = status?.content?.find((c: { type: string }) => c.type === "text")?.text ?? "";
          debugLog(`Status check ${attempt + 1}:`, statusText);
          if (statusText && !statusText.includes("not connected") && !statusText.includes("not available")) {
            debugLog("MCP server appears ready");
            break;
          }
        } catch (statusErr) {
          debugLog(`Status check ${attempt + 1} failed:`, statusErr instanceof Error ? statusErr.message : String(statusErr));
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      debugLog("Calling figma_get_variables...");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await client.callTool({
        name: "figma_get_variables",
        arguments: {
          fileUrl,
          format: "full",
          verbosity: "standard",
        },
      });

      debugLog("Raw figma_get_variables result type", typeof result);
      debugLog("Raw figma_get_variables content items count", result?.content?.length);
      if (result?.content) {
        for (let i = 0; i < result.content.length; i++) {
          const item = result.content[i];
          debugLog(`Content item ${i}: type=${item.type}, textLength=${item.text?.length ?? "N/A"}`);
          if (item.text) {
            debugLog(`Content item ${i} preview:`, item.text.substring(0, 1000));
          }
        }
      }

      await client.close();

      return this.parseVariablesResult(result);
    } catch (error) {
      debugLog("MCP client error", error instanceof Error ? error.message : String(error));
      try {
        await client.close();
      } catch {
        // Ignore close errors
      }
      throw error;
    }
  }

  private parseVariablesResult(
    result: { content?: Array<{ type: string; text?: string; data?: unknown }> },
  ): Record<string, FigmaVariable> {
    debugLog("parseVariablesResult: raw content items", result.content?.map(c => ({ type: c.type, textLen: c.text?.length })));

    if (!result.content || result.content.length === 0) {
      console.warn("MCP response has no content items");
      return {};
    }

    // Collect all text content items and try to parse each
    const textItems = result.content.filter((c) => c.type === "text" && c.text);
    debugLog(`parseVariablesResult: found ${textItems.length} text content items`);

    for (const textContent of textItems) {
      const text = textContent.text!;
      debugLog("parseVariablesResult: text length", text.length);
      debugLog("parseVariablesResult: text preview", text.substring(0, 500));

      const variables = this.tryParseVariablesFromText(text);
      if (Object.keys(variables).length > 0) {
        debugLog(`parseVariablesResult: successfully parsed ${Object.keys(variables).length} variables`);
        return variables;
      }
    }

    // Also try to extract data from non-text content items
    for (const item of result.content) {
      if (item.type !== "text" && item.data) {
        debugLog("parseVariablesResult: trying non-text content data item");
        const variables = this.tryParseVariablesFromData(item.data);
        if (Object.keys(variables).length > 0) {
          return variables;
        }
      }
    }

    console.warn("Could not extract any variables from MCP response");
    return {};
  }

  private tryParseVariablesFromText(text: string): Record<string, FigmaVariable> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Try to extract JSON from within the text
      const jsonMatch = text.match(/\[[\s\S]*\]|{[\s\S]*}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          debugLog("tryParseVariablesFromText: found JSON-like text but failed to parse");
          return {};
        }
      } else {
        debugLog("tryParseVariablesFromText: no JSON found in text");
        return {};
      }
    }

    return this.extractVariablesFromParsed(parsed);
  }

  private tryParseVariablesFromData(data: unknown): Record<string, FigmaVariable> {
    if (typeof data === "object" && data !== null) {
      return this.extractVariablesFromParsed(data);
    }
    return {};
  }

  private extractVariablesFromParsed(parsed: unknown): Record<string, FigmaVariable> {
    let variablesArray: McpVariable[] = [];

    if (Array.isArray(parsed)) {
      // Check if this looks like an array of variables
      const firstItem = parsed[0];
      if (firstItem && typeof firstItem === "object" && "id" in firstItem && "name" in firstItem) {
        variablesArray = parsed as McpVariable[];
      } else if (firstItem && typeof firstItem === "object" && "variables" in (firstItem as Record<string, unknown>)) {
        // Array of objects each containing variables - merge them
        for (const item of parsed) {
          const objVars = (item as Record<string, unknown>).variables;
          if (typeof objVars === "object" && objVars !== null) {
            const extracted = this.extractVariablesFromParsed(objVars);
            if (Object.keys(extracted).length > 0) {
              return extracted;
            }
          }
        }
      }
    } else if (typeof parsed === "object" && parsed !== null) {
      const obj = parsed as Record<string, unknown>;

      // Direct variables array: { variables: [...] }
      if (Array.isArray(obj.variables)) {
        variablesArray = obj.variables as McpVariable[];
      }
      // Nested in meta: { meta: { variables: {...} } }
      else if (obj.meta && typeof obj.meta === "object" && (obj.meta as Record<string, unknown>).variables) {
        const varsById = (obj.meta as Record<string, unknown>).variables as Record<string, McpVariable>;
        variablesArray = Object.values(varsById);
      }
      // Nested in collections format: { collections: [...], variables: [...] }
      else if (Array.isArray(obj.collections) && Array.isArray(obj.variables)) {
        variablesArray = obj.variables as McpVariable[];
      }
      // REST API format with nested meta.variables containing variable collections
      else if (obj.meta && typeof obj.meta === "object") {
        const meta = obj.meta as Record<string, unknown>;
        if (typeof meta.variables === "object" && meta.variables !== null) {
          const varsById = meta.variables as Record<string, unknown>;
          // Could be { id: var } or { collectionId: { id: var } }
          const allVars: McpVariable[] = [];
          for (const varEntry of Object.values(varsById)) {
            if (typeof varEntry === "object" && varEntry !== null) {
              if ("id" in varEntry && "name" in varEntry) {
                allVars.push(varEntry as McpVariable);
              } else {
                // Nested by collection ID
                const innerVars = this.extractVariablesFromParsed(varEntry);
                if (Object.keys(innerVars).length > 0) {
                  return innerVars;
                }
              }
            }
          }
          variablesArray = allVars;
        }
      }
      // Keyed by ID: { "VariableID:1": { id, name, ... } }
      else {
        const entries = Object.entries(obj);
        if (entries.length > 0) {
          const firstValue = entries[0]?.[1];
          if (typeof firstValue === "object" && firstValue !== null && "id" in firstValue && "name" in firstValue) {
            variablesArray = Object.values(obj as Record<string, McpVariable>);
          } else {
            // Try deeper nesting - check for variable collections
            for (const [, value] of entries) {
              if (typeof value === "object" && value !== null) {
                const innerVars = this.extractVariablesFromParsed(value);
                if (Object.keys(innerVars).length > 0) {
                  return innerVars;
                }
              }
            }
          }
        }
      }
    }

    const variables: Record<string, FigmaVariable> = {};
    for (const v of variablesArray) {
      if (!v || typeof v !== "object" || !v.id || !v.name) continue;

      const valuesByMode: Record<string, FigmaVariableValue> = {};
      if (v.valuesByMode && typeof v.valuesByMode === "object") {
        for (const [modeId, rawValue] of Object.entries(v.valuesByMode)) {
          valuesByMode[modeId] = mapMcpVariableValue(rawValue);
        }
      }

      variables[v.id] = {
        id: v.id,
        name: v.name,
        variableCollectionId: v.variableCollectionId ?? "",
        resolvedType: v.resolvedType,
        valuesByMode,
      };
    }

    return variables;
  }
}