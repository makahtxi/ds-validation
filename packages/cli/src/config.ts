import fs from "fs";
import path from "path";
import jiti from "jiti";
import type { DSValidationConfig } from "@ds-validation/core";

export function loadConfig(): DSValidationConfig {
  const configPath = path.resolve(process.cwd(), "ds-validation.config.ts");

  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    const loadModule = jiti(process.cwd(), { interopDefault: true });
    const config = loadModule(configPath) as DSValidationConfig;
    return config ?? {};
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`Warning: Failed to load ds-validation.config.ts: ${msg}`);
    return {};
  }
}