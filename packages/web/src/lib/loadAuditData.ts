import fs from "node:fs";
import path from "node:path";
import type { AuditResult, ComponentAuditResult } from "@ds-validation/core";

const OUTPUT_DIR =
  process.env.AUDIT_OUTPUT_DIR || path.join(process.cwd(), "../../output");

export type { AuditResult, ComponentAuditResult };

export function loadAuditData(): AuditResult | null {
  const filePath = path.join(OUTPUT_DIR, "audit.json");
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as AuditResult;
}

export function loadComponentData(name: string): ComponentAuditResult | null {
  const filePath = path.join(OUTPUT_DIR, "components", `${name}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as ComponentAuditResult;
}

export function listComponents(): string[] {
  const componentsDir = path.join(OUTPUT_DIR, "components");
  if (!fs.existsSync(componentsDir)) return [];
  return fs
    .readdirSync(componentsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""));
}
