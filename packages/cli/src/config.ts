import fs from "fs";
import path from "path";
import jiti from "jiti";
import type { DSValidationConfig } from "@ds-validation/core";

const CONFIG_BASENAME = "ds-validation.config";

export function loadConfig(): DSValidationConfig {
  const cwd = process.cwd();

  const tsPath = path.resolve(cwd, `${CONFIG_BASENAME}.ts`);
  if (fs.existsSync(tsPath)) {
    return loadWithJiti(tsPath, cwd);
  }

  const jsPath = path.resolve(cwd, `${CONFIG_BASENAME}.js`);
  if (fs.existsSync(jsPath)) {
    return requireConfig(jsPath);
  }

  const mjsPath = path.resolve(cwd, `${CONFIG_BASENAME}.mjs`);
  if (fs.existsSync(mjsPath)) {
    return requireConfig(mjsPath);
  }

  return {};
}

function loadWithJiti(configPath: string, cwd: string): DSValidationConfig {
  try {
    const loadModule = jiti(cwd, { interopDefault: true });
    const config = loadModule(configPath) as DSValidationConfig;
    return config ?? {};
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`Warning: Failed to load ${path.basename(configPath)}: ${msg}`);
    return {};
  }
}

function requireConfig(configPath: string): DSValidationConfig {
  try {
    const config = require(configPath);
    return (config.default ?? config) as DSValidationConfig;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`Warning: Failed to load ${path.basename(configPath)}: ${msg}`);
    return {};
  }
}