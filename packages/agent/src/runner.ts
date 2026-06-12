import { FigmaClient } from "@ds-validation/figma";
import type {
  AuditFileResult,
  ComponentClassification,
  FigmaVariable,
  FigmaPageSummary,
  FigmaNode,
  ClassificationStore,
} from "@ds-validation/core";
import { auditFile } from "./orchestrator.js";
import { registry } from "./checks/registry.js";
import { collectAmbiguousComponents } from "./classifier.js";

export interface AuditRunConfig {
  checkWeights?: Record<string, number>;
  checkOverrides?: Record<string, { enabled?: boolean; weight?: number }>;
  classificationOverrides?: Record<string, { interactive?: string[]; nonInteractive?: string[] }>;
}

export interface RunAuditOptions {
  token: string;
  fileKey: string;
  pageNames: string[];
  variables: Record<string, FigmaVariable>;
  classifications?: Record<string, Record<string, ComponentClassification>>;
  config?: AuditRunConfig;
  classificationStore?: ClassificationStore;
  onProgress?: (stage: string, current: number, total: number) => void;
}

export interface ResolveFileResult {
  fileKey: string;
  fileName: string;
  pages: FigmaPageSummary[];
}

export async function resolveFile(
  token: string,
  url: string,
): Promise<ResolveFileResult> {
  const fileKey = parseFileKey(url);
  if (!fileKey) {
    throw new Error(
      `Could not parse Figma file key from URL: ${url}. Expected format: https://www.figma.com/design/<fileKey>/...`,
    );
  }

  const client = new FigmaClient(token);
  const { meta, pages } = await client.getFileData(fileKey);

  return { fileKey, fileName: meta.name, pages };
}

export async function runAudit(
  options: RunAuditOptions,
): Promise<AuditFileResult> {
  const {
    token,
    fileKey,
    pageNames,
    variables,
    classifications: providedClassifications,
    config,
    classificationStore,
    onProgress,
  } = options;

  const client = new FigmaClient(token);

  const { meta, pages: allPages } = await client.getFileData(fileKey);

  const selectedPages = allPages.filter((p) => pageNames.includes(p.name));

  onProgress?.("fetching-nodes", 0, selectedPages.length);

  const pageComponentResults = await Promise.all(
    selectedPages.map(async (page, i) => {
      const components = await client.getComponentNodesWithData(fileKey, page.id);
      onProgress?.("fetching-nodes", i + 1, selectedPages.length);
      return { page, components };
    }),
  );

  const componentNodes = new Map<string, FigmaNode>();
  const componentPageMap = new Map<string, string>();
  for (const { page, components } of pageComponentResults) {
    for (const comp of components) {
      componentNodes.set(comp.name, comp);
      componentPageMap.set(comp.name, page.name);
    }
  }

  const savedDecisions = classificationStore?.load(fileKey) ?? {};
  const componentNames = Array.from(componentNodes.keys());
  const checksWithRules = registry.getAll().filter((c) => c.componentRules);

  const classificationOverrides = config?.classificationOverrides ?? {};

  const { ambiguous, autoClassified } = collectAmbiguousComponents(
    componentNames,
    checksWithRules,
    savedDecisions,
    classificationOverrides,
  );

  const classifications: Record<
    string,
    Record<string, ComponentClassification>
  > = { ...providedClassifications };

  for (const [key, value] of Object.entries(savedDecisions)) {
    const sep = key.indexOf(":");
    if (sep === -1) continue;
    const compName = key.slice(0, sep);
    const checkId = key.slice(sep + 1);
    if (!classifications[compName]) classifications[compName] = {};
    classifications[compName][checkId] = value;
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
    if (!classifications[item.componentName])
      classifications[item.componentName] = {};
    if (!classifications[item.componentName][item.checkId]) {
      classifications[item.componentName][item.checkId] = "non-interactive";
    }
  }

  const variablesAvailable = Object.keys(variables).length > 0;
  const checkOverrides = { ...config?.checkOverrides };
  if (!variablesAvailable) {
    checkOverrides["no-primitive-tokens"] = { enabled: false };
  }

  onProgress?.("auditing", 0, componentNodes.size);

  const result = await auditFile({
    fileKey,
    fileName: meta.name,
    pageNames,
    componentNodes,
    componentPageMap,
    styles: {},
    variables,
    checkWeights: config?.checkWeights,
    checkOverrides,
    classifications,
  });

  onProgress?.("auditing", componentNodes.size, componentNodes.size);

  return result;
}

function parseFileKey(url: string): string | null {
  const match = url.match(/figma\.com\/(?:design|file)\/([a-zA-Z0-9]+)/);
  if (match) {
    return match[1];
  }
  if (/^[a-zA-Z0-9]+$/.test(url)) {
    return url;
  }
  return null;
}
