import fs from "node:fs";
import path from "node:path";
import type { AuditResult, ComponentAuditResult } from "../types/checks.js";

export function loadAuditResult(outputDir: string): AuditResult | null {
  const filePath = path.join(outputDir, "audit.json");
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as AuditResult;
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
  const sanitized = result.componentName.replace(/[\\/:*?"<>|]/g, "_");
  const filePath = path.join(componentsDir, `${sanitized}.json`);
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
  return filePath;
}
