import http from "node:http";
import type { FigmaVariable, FigmaColor, FigmaVariableValue } from "@ds-validation/core";

export interface PluginClientConfig {
  port?: number;
  timeoutMs?: number;
}

function mapVariableValue(raw: unknown): FigmaVariableValue {
  if (typeof raw === "number" || typeof raw === "string" || typeof raw === "boolean") {
    return raw;
  }
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if (obj.type === "VARIABLE_ALIAS" && typeof obj.id === "string") {
      return { type: "VARIABLE_ALIAS", id: obj.id };
    }
    if (typeof obj.r === "number" && typeof obj.g === "number" && typeof obj.b === "number") {
      return {
        r: obj.r,
        g: obj.g,
        b: obj.b,
        a: typeof obj.a === "number" ? obj.a : 1,
      } as FigmaColor;
    }
  }
  return String(raw);
}

export class PluginVariableClient {
  private config: Required<PluginClientConfig>;

  constructor(config: PluginClientConfig = {}) {
    this.config = {
      port: config.port ?? 7070,
      timeoutMs: config.timeoutMs ?? 60_000,
    };
  }

  getVariables(): Promise<Record<string, FigmaVariable>> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

        if (req.method === "OPTIONS") {
          res.writeHead(204);
          res.end();
          return;
        }

        if (req.method !== "POST" || req.url !== "/variables") {
          res.writeHead(404);
          res.end();
          return;
        }

        let body = "";
        req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
        req.on("end", () => {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
          server.close();
          clearTimeout(timer);

          try {
            const raw = JSON.parse(body) as Record<string, unknown>;
            const variables: Record<string, FigmaVariable> = {};

            for (const [id, rawVar] of Object.entries(raw)) {
              if (!rawVar || typeof rawVar !== "object") continue;
              const v = rawVar as Record<string, unknown>;
              if (typeof v.id !== "string" || typeof v.name !== "string" || typeof v.resolvedType !== "string") continue;

              const valuesByMode: Record<string, FigmaVariableValue> = {};
              if (v.valuesByMode && typeof v.valuesByMode === "object") {
                for (const [modeId, val] of Object.entries(v.valuesByMode as Record<string, unknown>)) {
                  valuesByMode[modeId] = mapVariableValue(val);
                }
              }

              variables[id] = {
                id: v.id,
                name: v.name,
                variableCollectionId: typeof v.variableCollectionId === "string" ? v.variableCollectionId : "",
                resolvedType: v.resolvedType as FigmaVariable["resolvedType"],
                valuesByMode,
              };
            }

            resolve(variables);
          } catch (err) {
            reject(new Error(`Failed to parse plugin response: ${err}`));
          }
        });
      });

      const timer = setTimeout(() => {
        server.close();
        reject(new Error(`Timed out after ${this.config.timeoutMs}ms waiting for the DS Validation Figma plugin`));
      }, this.config.timeoutMs);

      server.listen(this.config.port, "127.0.0.1", () => {
        console.log(`  Listening on port ${this.config.port} for the DS Validation Figma plugin.`);
        console.log(`  Open the "DS Validation" plugin in your Figma file to continue.`);
      });

      server.on("error", (err: NodeJS.ErrnoException) => {
        clearTimeout(timer);
        if (err.code === "EADDRINUSE") {
          reject(new Error(`Port ${this.config.port} is already in use. Pass --plugin-port to use a different port.`));
        } else {
          reject(new Error(`Plugin server error: ${err.message}`));
        }
      });
    });
  }
}
