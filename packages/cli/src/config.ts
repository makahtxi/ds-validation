import fs from "fs";
import path from "path";
import type { DSValidationConfig } from "@ds-validation/core";

export async function loadConfig(): Promise<DSValidationConfig> {
  const configPath = path.resolve(process.cwd(), "ds-validation.config.ts");

  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    const module = await import(configPath);
    if (module.default) {
      return module.default as DSValidationConfig;
    }
    if (typeof module === "object" && !Array.isArray(module)) {
      const keys = Object.keys(module);
      if (keys.length > 0) {
        return module as unknown as DSValidationConfig;
      }
    }
    return {};
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`Warning: Failed to load ds-validation.config.ts: ${msg}`);
    return {};
  }
}