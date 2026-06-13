import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import "./register-checks.js";
import { registry } from "./checks/registry.js";
import { collectAmbiguousComponents } from "./classifier.js";
import {
  runAuditChunk,
  isRunComplete,
  finalizeRun,
  type RunnerState,
} from "./runner.js";
import type {
  AuditFileResult,
  ComponentClassification,
  FigmaNode,
  FigmaVariable,
} from "@ds-validation/core";

const FIXTURE_DIR = path.join(process.cwd(), "test", "fixtures");

function loadJson(file: string) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, file), "utf-8"));
}

// The captured baseline was produced with these saved classification decisions
// (same source as runner.test.ts), so the chunked run must use them to match.
function loadSavedDecisions(): Record<string, string> {
  const classPath = path.join(
    process.cwd(),
    ".ds-validation",
    "amizYpLxwZCeoPRVZEtLIk-classifications.json",
  );
  if (!fs.existsSync(classPath)) return {};
  return JSON.parse(fs.readFileSync(classPath, "utf-8")).decisions ?? {};
}

function buildClassifications(
  componentNames: string[],
  savedDecisions: Record<string, string>,
): Record<string, Record<string, ComponentClassification>> {
  const classifications: Record<
    string,
    Record<string, ComponentClassification>
  > = {};
  const checksWithRules = registry.getAll().filter((c) => c.componentRules);
  const { ambiguous, autoClassified } = collectAmbiguousComponents(
    componentNames,
    checksWithRules,
    savedDecisions as Record<string, ComponentClassification>,
    {},
  );
  const apply = (key: string, value: ComponentClassification) => {
    const sep = key.indexOf(":");
    if (sep === -1) return;
    const comp = key.slice(0, sep);
    const checkId = key.slice(sep + 1);
    if (!classifications[comp]) classifications[comp] = {};
    classifications[comp][checkId] = value;
  };
  for (const [k, v] of Object.entries(savedDecisions))
    apply(k, v as ComponentClassification);
  for (const [k, v] of Object.entries(autoClassified)) apply(k, v);
  for (const item of ambiguous) {
    if (!classifications[item.componentName])
      classifications[item.componentName] = {};
    classifications[item.componentName][item.checkId] = "non-interactive";
  }
  return classifications;
}

function buildState(): {
  state: RunnerState;
  variables: Record<string, FigmaVariable>;
} {
  const pageData: Record<string, FigmaNode[]> = loadJson("figma/page-data.json");
  const fileMeta: { key: string; name: string } = loadJson(
    "figma/file-meta.json",
  );
  const variables = loadJson("figma/variables.json");

  const componentNodes: Record<string, FigmaNode> = {};
  const componentPageMap: Record<string, string> = {};
  const componentOrder: string[] = [];
  for (const [pageName, comps] of Object.entries(pageData)) {
    for (const comp of comps) {
      if (!(comp.name in componentNodes)) componentOrder.push(comp.name);
      componentNodes[comp.name] = comp;
      componentPageMap[comp.name] = pageName;
    }
  }

  const checkOverrides: Record<string, { enabled?: boolean }> = {};
  if (Object.keys(variables).length === 0) {
    checkOverrides["no-primitive-tokens"] = { enabled: false };
  }

  const state: RunnerState = {
    fileKey: fileMeta.key,
    fileName: fileMeta.name,
    pageNames: Object.keys(pageData),
    componentOrder,
    componentNodes,
    componentPageMap,
    classifications: buildClassifications(componentOrder, loadSavedDecisions()),
    checkOverrides,
    cursor: 0,
    completed: [],
  };

  return { state, variables };
}

describe("runAuditChunk (resumable runner)", () => {
  it("chunked + resumed run equals an uninterrupted run", async () => {
    const { state, variables } = buildState();

    const full = await runAuditChunk(state, variables, Infinity);
    const fullResult = finalizeRun(full);

    // Audit in small chunks, JSON round-tripping between each to simulate a
    // persist-and-resume (e.g. the worker being killed and re-invoked).
    let s: RunnerState = JSON.parse(JSON.stringify(state));
    let chunks = 0;
    while (!isRunComplete(s)) {
      s = await runAuditChunk(s, variables, 7);
      s = JSON.parse(JSON.stringify(s)); // persist + resume
      chunks += 1;
      expect(s.completed.length).toBe(s.cursor); // checkpoint stays consistent
    }
    const resumedResult = finalizeRun(s);

    expect(chunks).toBeGreaterThan(1);
    // Per-component results and the file-level summary must be identical. (The
    // only field that legitimately differs is meta.auditedAt, a wall-clock
    // timestamp stamped at finalize time.)
    expect(resumedResult.components).toEqual(fullResult.components);
    expect(resumedResult.audit.components).toEqual(fullResult.audit.components);
    expect(resumedResult.audit.totalScore).toBe(fullResult.audit.totalScore);
  });

  it("matches the captured baseline", async () => {
    const { state, variables } = buildState();
    let s = state;
    while (!isRunComplete(s)) s = await runAuditChunk(s, variables, 5);
    const result = finalizeRun(s);

    const baseline = loadJson("baseline-audit.json") as AuditFileResult;
    expect(result.audit.totalScore).toBe(baseline.audit.totalScore);
    expect(result.components.length).toBe(baseline.components.length);
    for (const comp of result.components) {
      const b = baseline.components.find(
        (c) => c.componentName === comp.componentName,
      );
      expect(b?.score).toBe(comp.score);
    }
  });

  it("advances the cursor one component at a time with chunk size 1", async () => {
    const { state, variables } = buildState();
    const s1 = await runAuditChunk(state, variables, 1);
    expect(s1.cursor).toBe(1);
    expect(s1.completed.length).toBe(1);
    const s2 = await runAuditChunk(s1, variables, 1);
    expect(s2.cursor).toBe(2);
  });
});
