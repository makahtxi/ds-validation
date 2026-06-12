import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import "./register-checks.js";
import { registry } from "./checks/registry.js";
import { collectAmbiguousComponents } from "./classifier.js";
import type { AuditFileResult, ComponentClassification } from "@ds-validation/core";

const FIXTURE_DIR = path.join(process.cwd(), "test", "fixtures");

function loadJson(file: string) {
  const raw = fs.readFileSync(path.join(FIXTURE_DIR, file), "utf-8");
  return JSON.parse(raw);
}

function buildClassifications(
  componentNames: string[],
  savedDecisions: Record<string, string>,
): Record<string, Record<string, ComponentClassification>> {
  const classifications: Record<string, Record<string, ComponentClassification>> = {};

  const checksWithRules = registry.getAll().filter((c) => c.componentRules);

  const { ambiguous, autoClassified } = collectAmbiguousComponents(
    componentNames,
    checksWithRules,
    savedDecisions as Record<string, ComponentClassification>,
    {},
  );

  for (const [key, value] of Object.entries(savedDecisions)) {
    const sep = key.indexOf(":");
    if (sep === -1) continue;
    const compName = key.slice(0, sep);
    const checkId = key.slice(sep + 1);
    if (!classifications[compName]) classifications[compName] = {};
    classifications[compName][checkId] = value as ComponentClassification;
  }

  for (const [key, classification] of Object.entries(autoClassified)) {
    const sep = key.indexOf(":");
    if (sep === -1) continue;
    const compName = key.slice(0, sep);
    const checkId = key.slice(sep + 1);
    if (!classifications[compName]) classifications[compName] = {};
    classifications[compName][checkId] = classification;
  }

  for (const item of ambiguous) {
    if (!classifications[item.componentName]) classifications[item.componentName] = {};
    classifications[item.componentName][item.checkId] = "non-interactive";
  }

  return classifications;
}

describe("runAudit (fixture-based)", () => {
  it("produces the same result as the captured baseline", async () => {
    const pageData: Record<string, unknown[]> = loadJson("figma/page-data.json");
    const fileMeta: { key: string; name: string } = loadJson("figma/file-meta.json");
    const variables = loadJson("figma/variables.json");

    const allComponents: { name: string; node: unknown; pageName: string }[] = [];
    for (const [pageName, components] of Object.entries(pageData)) {
      for (const comp of components as Array<{ name: string }>) {
        allComponents.push({ name: comp.name, node: comp, pageName });
      }
    }

    const componentNodes = new Map<string, unknown>();
    const componentPageMap = new Map<string, string>();
    for (const c of allComponents) {
      componentNodes.set(c.name, c.node);
      componentPageMap.set(c.name, c.pageName);
    }

    const savedDecisions = loadClassificationsForFixture();
    const classifications = buildClassifications(
      Array.from(componentNodes.keys()),
      savedDecisions,
    );

    const { auditFile } = await import("./orchestrator");

    const variablesAvailable = Object.keys(variables).length > 0;
    const checkOverrides: Record<string, { enabled?: boolean }> = {};
    if (!variablesAvailable) {
      checkOverrides["no-primitive-tokens"] = { enabled: false };
    }

    const result = await auditFile({
      fileKey: fileMeta.key,
      fileName: fileMeta.name,
      pageNames: Object.keys(pageData),
      componentNodes: componentNodes as Parameters<typeof auditFile>[0]["componentNodes"],
      componentPageMap,
      styles: {},
      variables,
      checkOverrides,
      classifications,
    });

    const baseline = loadJson("baseline-audit.json") as AuditFileResult;

    expect(result.audit.totalScore).toBe(baseline.audit.totalScore);
    expect(result.audit.components.length).toBe(baseline.audit.components.length);
    expect(result.components.length).toBe(baseline.components.length);

    for (const comp of result.components) {
      const baselineComp = baseline.components.find(
        (c) => c.componentName === comp.componentName,
      );
      expect(baselineComp).toBeDefined();
      if (baselineComp) {
        expect(comp.score).toBe(baselineComp.score);
        expect(Object.keys(comp.checkResults).length).toBe(
          Object.keys(baselineComp.checkResults).length,
        );
      }
    }
  });

  it("is serializable (JSON.parse(JSON.stringify(result)) deep-equals)", async () => {
    const pageData: Record<string, unknown[]> = loadJson("figma/page-data.json");
    const fileMeta: { key: string; name: string } = loadJson("figma/file-meta.json");
    const variables = loadJson("figma/variables.json");

    const allComponents: { name: string; node: unknown; pageName: string }[] = [];
    for (const [pageName, components] of Object.entries(pageData)) {
      for (const comp of components as Array<{ name: string }>) {
        allComponents.push({ name: comp.name, node: comp, pageName });
      }
    }

    const componentNodes = new Map<string, unknown>();
    const componentPageMap = new Map<string, string>();
    for (const c of allComponents) {
      componentNodes.set(c.name, c.node);
      componentPageMap.set(c.name, c.pageName);
    }

    const { auditFile } = await import("./orchestrator");
    const variablesAvailable = Object.keys(variables).length > 0;
    const checkOverrides: Record<string, { enabled?: boolean }> = {};
    if (!variablesAvailable) {
      checkOverrides["no-primitive-tokens"] = { enabled: false };
    }
    const result = await auditFile({
      fileKey: fileMeta.key,
      fileName: fileMeta.name,
      pageNames: Object.keys(pageData),
      componentNodes: componentNodes as Parameters<typeof auditFile>[0]["componentNodes"],
      componentPageMap,
      styles: {},
      variables,
      checkOverrides,
    });

    const serialized = JSON.parse(JSON.stringify(result));
    expect(serialized).toEqual(result);
  });
});

function loadClassificationsForFixture(): Record<string, string> {
  const classPath = path.join(
    process.cwd(),
    ".ds-validation",
    "amizYpLxwZCeoPRVZEtLIk-classifications.json",
  );
  if (!fs.existsSync(classPath)) return {};
  const raw = fs.readFileSync(classPath, "utf-8");
  const parsed = JSON.parse(raw);
  return parsed.decisions ?? {};
}
