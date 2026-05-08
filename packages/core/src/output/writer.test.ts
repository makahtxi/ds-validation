import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  writeAuditResult,
  writeComponentResult,
  loadAuditResult,
  sanitizeComponentName,
} from "./writer.js";
import type { AuditResult, ComponentAuditResult } from "../types/checks.js";

function makeAuditResult(overrides?: Partial<AuditResult>): AuditResult {
  return {
    meta: {
      figmaFileKey: "test-file-key",
      figmaFileName: "Test File",
      auditedAt: new Date().toISOString(),
      pagesAudited: ["Page 1"],
      conformanceChecks: [
        { id: "hardcoded-colors", name: "No Hard-Coded Colors", weight: 0.25 },
      ],
    },
    totalScore: 75,
    summary: { template: "test", params: {} },
    components: [
      {
        name: "Button",
        score: 75,
        jsonPath: "components/Button.json",
        passedChecks: 3,
        totalChecks: 5,
        pageName: "Page 1",
      },
    ],
    ...overrides,
  };
}

function makeComponentResult(
  overrides?: Partial<ComponentAuditResult>,
): ComponentAuditResult {
  return {
    componentName: "Button",
    score: 80,
    checkResults: {
      "hardcoded-colors": {
        checkId: "hardcoded-colors",
        score: 80,
        status: "partial",
        violations: [],
        summary: { template: "hardcoded_colors_found", params: { count: 2 } },
      },
    },
    pageName: "Page 1",
    ...overrides,
  };
}

describe("writeAuditResult", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ds-validation-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes a valid audit result to audit.json", () => {
    const result = makeAuditResult();
    const filePath = writeAuditResult(tmpDir, result);

    expect(filePath).toBe(path.join(tmpDir, "audit.json"));
    expect(fs.existsSync(filePath)).toBe(true);

    const written = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    expect(written.totalScore).toBe(75);
    expect(written.components).toHaveLength(1);
  });

  it("creates output dir if it does not exist", () => {
    const nested = path.join(tmpDir, "nested", "dir");
    writeAuditResult(nested, makeAuditResult());
    expect(fs.existsSync(path.join(nested, "audit.json"))).toBe(true);
  });
});

describe("writeComponentResult", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ds-validation-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes a valid component result to components/<name>.json", () => {
    const result = makeComponentResult();
    const filePath = writeComponentResult(tmpDir, result);

    expect(filePath).toBe(path.join(tmpDir, "components", "Button.json"));
    expect(fs.existsSync(filePath)).toBe(true);

    const written = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    expect(written.componentName).toBe("Button");
  });

  it("sanitizes component names with special characters", () => {
    const result = makeComponentResult({ componentName: "My/Button" });
    const filePath = writeComponentResult(tmpDir, result);

    expect(filePath).toBe(path.join(tmpDir, "components", "My_Button.json"));
    expect(fs.existsSync(filePath)).toBe(true);
  });
});

describe("loadAuditResult", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ds-validation-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns null when audit.json does not exist", () => {
    expect(loadAuditResult(tmpDir)).toBeNull();
  });

  it("reads and parses a valid audit.json", () => {
    const result = makeAuditResult();
    writeAuditResult(tmpDir, result);

    const loaded = loadAuditResult(tmpDir);
    expect(loaded).not.toBeNull();
    expect(loaded!.meta.figmaFileKey).toBe("test-file-key");
    expect(loaded!.components).toHaveLength(1);
  });

  it("returns null and warns when audit.json is corrupted", () => {
    fs.writeFileSync(path.join(tmpDir, "audit.json"), "not valid json {{{");

    const loaded = loadAuditResult(tmpDir);
    expect(loaded).toBeNull();
  });

  it("returns null when audit.json has invalid schema", () => {
    fs.writeFileSync(
      path.join(tmpDir, "audit.json"),
      JSON.stringify({ foo: "bar" }),
    );

    const loaded = loadAuditResult(tmpDir);
    expect(loaded).toBeNull();
  });
});

describe("sanitizeComponentName", () => {
  it("leaves alphanumeric names unchanged", () => {
    expect(sanitizeComponentName("Button")).toBe("Button");
  });

  it("replaces slashes with underscores", () => {
    expect(sanitizeComponentName("Button/Primary")).toBe("Button_Primary");
  });

  it("replaces spaces with underscores", () => {
    expect(sanitizeComponentName("My Button")).toBe("My_Button");
  });

  it("replaces dots with underscores", () => {
    expect(sanitizeComponentName("Button.v2")).toBe("Button_v2");
  });

  it("replaces multiple special characters", () => {
    expect(sanitizeComponentName("My/Button v2.0")).toBe("My_Button_v2_0");
  });

  it("preserves hyphens and underscores", () => {
    expect(sanitizeComponentName("my-button_test")).toBe("my-button_test");
  });
});
