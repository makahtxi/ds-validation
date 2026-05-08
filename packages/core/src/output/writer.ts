import fs from "node:fs";
import path from "node:path";
import type { AuditResult, ComponentAuditResult } from "../types/checks.js";
import { AuditResultSchema } from "./schemas.js";
import { sanitizeComponentName } from "./sanitize.js";

export function loadAuditResult(outputDir: string): AuditResult | null {
  const filePath = path.join(outputDir, "audit.json");
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    const result = AuditResultSchema.safeParse(parsed);
    if (!result.success) {
      console.warn(
        `Warning: audit.json is invalid, starting fresh. Errors: ${result.error.message}`,
      );
      return null;
    }
    return result.data;
  } catch {
    console.warn(
      "Warning: failed to read audit.json, starting fresh.",
    );
    return null;
  }
}

export function writeAuditResult(
  outputDir: string,
  result: AuditResult,
): string {
  fs.mkdirSync(outputDir, { recursive: true });
  const filePath = path.join(outputDir, "audit.json");
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
  return filePath;
}

export function writeComponentResult(
  outputDir: string,
  result: ComponentAuditResult,
): string {
  const componentsDir = path.join(outputDir, "components");
  fs.mkdirSync(componentsDir, { recursive: true });
  const sanitized = sanitizeComponentName(result.componentName);
  const filePath = path.join(componentsDir, `${sanitized}.json`);
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
  return filePath;
}

export { sanitizeComponentName };
