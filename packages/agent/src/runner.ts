import { FigmaClient, type FigmaTokenType } from "@ds-validation/figma";
import type {
  AuditFileResult,
  ComponentAuditResult,
  ComponentClassification,
  FigmaVariable,
  FigmaPageSummary,
  FigmaNode,
  ClassificationStore,
} from "@ds-validation/core";
import { auditComponent, assembleAuditResult } from "./orchestrator.js";
import { registry } from "./checks/registry.js";
import { collectAmbiguousComponents } from "./classifier.js";

export interface AuditRunConfig {
  checkWeights?: Record<string, number>;
  checkOverrides?: Record<string, { enabled?: boolean; weight?: number }>;
  classificationOverrides?: Record<string, { interactive?: string[]; nonInteractive?: string[] }>;
}

export interface RunAuditOptions {
  token: string;
  /** Auth header style for the Figma token. OAuth tokens use Bearer; PATs use X-Figma-Token. */
  tokenType?: FigmaTokenType;
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

/**
 * Serializable checkpoint for a chunked / resumable audit run.
 *
 * Produced by {@link prepareRunnerState} (the network-bound phase) and advanced
 * by {@link runAuditChunk} (pure CPU, no network). It can be JSON round-tripped
 * and persisted between invocations so a run that is killed mid-flight can be
 * resumed from where it left off — see the web worker.
 */
export interface RunnerState {
  fileKey: string;
  fileName: string;
  pageNames: string[];
  /** Stable component ordering so a resumed run audits in the same order. */
  componentOrder: string[];
  componentNodes: Record<string, FigmaNode>;
  componentPageMap: Record<string, string>;
  classifications: Record<string, Record<string, ComponentClassification>>;
  checkWeights?: Record<string, number>;
  checkOverrides?: Record<string, { enabled?: boolean; weight?: number }>;
  /** Index into componentOrder of the next component to audit. */
  cursor: number;
  /** Per-component results accumulated so far. */
  completed: ComponentAuditResult[];
}

export type ProgressCallback = (
  stage: string,
  current: number,
  total: number,
) => void;

export async function resolveFile(
  token: string,
  url: string,
  tokenType: FigmaTokenType = "pat",
): Promise<ResolveFileResult> {
  const fileKey = parseFileKey(url);
  if (!fileKey) {
    throw new Error(
      `Could not parse Figma file key from URL: ${url}. Expected format: https://www.figma.com/design/<fileKey>/...`,
    );
  }

  const client = new FigmaClient(token, tokenType);
  const { meta, pages } = await client.getFileData(fileKey);

  return { fileKey, fileName: meta.name, pages };
}

/**
 * Fetch the selected pages' components from Figma and resolve all component
 * classifications, returning a fresh {@link RunnerState} with the cursor at 0.
 * This is the only phase that hits the network.
 */
export async function prepareRunnerState(
  options: RunAuditOptions,
): Promise<RunnerState> {
  const {
    token,
    tokenType = "pat",
    fileKey,
    pageNames,
    variables,
    classifications: providedClassifications,
    config,
    classificationStore,
    onProgress,
  } = options;

  const client = new FigmaClient(token, tokenType);

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

  const componentNodes: Record<string, FigmaNode> = {};
  const componentPageMap: Record<string, string> = {};
  const componentOrder: string[] = [];
  for (const { page, components } of pageComponentResults) {
    for (const comp of components) {
      if (!(comp.name in componentNodes)) componentOrder.push(comp.name);
      componentNodes[comp.name] = comp;
      componentPageMap[comp.name] = page.name;
    }
  }

  const savedDecisions = classificationStore?.load(fileKey) ?? {};
  const checksWithRules = registry.getAll().filter((c) => c.componentRules);
  const classificationOverrides = config?.classificationOverrides ?? {};

  const { ambiguous, autoClassified } = collectAmbiguousComponents(
    componentOrder,
    checksWithRules,
    savedDecisions,
    classificationOverrides,
  );

  const classifications: Record<
    string,
    Record<string, ComponentClassification>
  > = { ...providedClassifications };

  const applyDecision = (key: string, value: ComponentClassification) => {
    const sep = key.indexOf(":");
    if (sep === -1) return;
    const compName = key.slice(0, sep);
    const checkId = key.slice(sep + 1);
    if (!classifications[compName]) classifications[compName] = {};
    classifications[compName][checkId] = value;
  };

  for (const [key, value] of Object.entries(savedDecisions)) {
    applyDecision(key, value);
  }
  for (const [key, value] of Object.entries(autoClassified)) {
    applyDecision(key, value);
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

  onProgress?.("auditing", 0, componentOrder.length);

  return {
    fileKey,
    fileName: meta.name,
    pageNames,
    componentOrder,
    componentNodes,
    componentPageMap,
    classifications,
    checkWeights: config?.checkWeights,
    checkOverrides,
    cursor: 0,
    completed: [],
  };
}

/**
 * Audit up to `chunkSize` more components, returning a new {@link RunnerState}
 * with the cursor advanced and results appended. Pure CPU — no network — so it
 * is safe to resume from a persisted state. `variables` is the same map passed
 * to {@link prepareRunnerState} (not stored in state to keep checkpoints small).
 */
export async function runAuditChunk(
  state: RunnerState,
  variables: Record<string, FigmaVariable>,
  chunkSize: number = Infinity,
  onProgress?: ProgressCallback,
): Promise<RunnerState> {
  const total = state.componentOrder.length;
  const end = Math.min(state.cursor + chunkSize, total);
  const completed = [...state.completed];

  for (let i = state.cursor; i < end; i++) {
    const name = state.componentOrder[i];
    const node = state.componentNodes[name];
    const pageName = state.componentPageMap[name] ?? "Unknown";
    const result = await auditComponent(
      name,
      node,
      pageName,
      {},
      variables,
      state.checkWeights,
      state.checkOverrides,
      state.classifications[name],
    );
    completed.push(result);
    onProgress?.("auditing", completed.length, total);
  }

  return { ...state, cursor: end, completed };
}

/** Whether every component in the run has been audited. */
export function isRunComplete(state: RunnerState): boolean {
  return state.cursor >= state.componentOrder.length;
}

/** Assemble the final file-level result from a completed {@link RunnerState}. */
export function finalizeRun(state: RunnerState): AuditFileResult {
  return assembleAuditResult(
    {
      fileKey: state.fileKey,
      fileName: state.fileName,
      pageNames: state.pageNames,
      checkWeights: state.checkWeights,
      checkOverrides: state.checkOverrides,
    },
    state.completed,
  );
}

/**
 * Run a full audit in one call. Thin wrapper over the chunked runner with an
 * unbounded chunk size — behaviourally identical to auditing every component in
 * a single pass.
 */
export async function runAudit(
  options: RunAuditOptions,
): Promise<AuditFileResult> {
  const prepared = await prepareRunnerState(options);
  const audited = await runAuditChunk(
    prepared,
    options.variables,
    Infinity,
    options.onProgress,
  );
  return finalizeRun(audited);
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
