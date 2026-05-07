import fs from "node:fs";
import path from "node:path";

const OUTPUT_DIR =
  process.env.AUDIT_OUTPUT_DIR || path.join(process.cwd(), "../../output");

export interface AuditData {
  meta: {
    figmaFileKey: string;
    figmaFileName: string;
    auditedAt: string;
    pagesAudited: string[];
    conformanceChecks: { id: string; name: string; weight: number }[];
  };
  totalScore: number;
  summary: { template: string; params: Record<string, string | number> };
  components: {
    name: string;
    score: number;
    jsonPath: string;
    passedChecks: number;
    totalChecks: number;
  }[];
}

export interface ComponentData {
  componentName: string;
  score: number;
  checkResults: Record<
    string,
    {
      checkId: string;
      score: number;
      status: string;
      violations: {
        nodePath: string;
        property: string;
        rawValue: string;
        expected: string;
        suggestedReplacement?: string;
      }[];
      summary: { template: string; params: Record<string, string | number> };
    }
  >;
}

export function loadAuditData(): AuditData | null {
  const filePath = path.join(OUTPUT_DIR, "audit.json");
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as AuditData;
}

export function loadComponentData(name: string): ComponentData | null {
  const filePath = path.join(OUTPUT_DIR, "components", `${name}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as ComponentData;
}

export function listComponents(): string[] {
  const componentsDir = path.join(OUTPUT_DIR, "components");
  if (!fs.existsSync(componentsDir)) return [];
  return fs
    .readdirSync(componentsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""));
}