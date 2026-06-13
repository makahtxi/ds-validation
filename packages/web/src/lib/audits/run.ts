import { FigmaClient } from "@ds-validation/figma";
import {
  prepareRunnerState,
  runAuditChunk,
  isRunComplete,
  finalizeRun,
  type RunnerState,
  type AuditRunConfig,
} from "@ds-validation/agent";
import type {
  AuditFileResult,
  ComponentClassification,
  FigmaVariable,
} from "@ds-validation/core";
import { createServiceClient } from "@/lib/supabase/service";
import { getFigmaToken } from "@/lib/figma-token";
import type { Database } from "@/lib/supabase/types";
import { PostgresClassificationStore } from "./classification-store";
import {
  CHUNK_SIZE,
  MAX_COMPONENTS,
  STALE_RUNNING_MS,
  WORKER_BUDGET_MS,
  getBaseUrl,
  getWorkerSecret,
} from "./config";

type AuditRow = Database["public"]["Tables"]["audits"]["Row"];
type ServiceClient = ReturnType<typeof createServiceClient>;

interface StoredRunnerState {
  state?: RunnerState;
  lease?: string;
}

export interface WorkerDeps {
  /** Hand off to a fresh invocation when the time budget is exhausted. */
  refire?: (auditId: string) => void | Promise<void>;
  now?: () => number;
  budgetMs?: number;
  chunkSize?: number;
}

/**
 * Execute (or resume) an audit run. Claims the audit, fetches the file, audits
 * components in resumable chunks while streaming progress to the DB, then writes
 * results. Designed so a killed run resumes from its persisted `runner_state`.
 *
 * Safe to call directly (tests, local) or from the worker route.
 */
export async function runAuditWorker(
  auditId: string,
  deps: WorkerDeps = {},
): Promise<void> {
  const now = deps.now ?? (() => Date.now());
  const budgetMs = deps.budgetMs ?? WORKER_BUDGET_MS;
  const chunkSize = deps.chunkSize ?? CHUNK_SIZE;
  const refire = deps.refire ?? startWorker;
  const tick0 = now();
  const supabase = createServiceClient();

  const { data: audit } = await supabase
    .from("audits")
    .select("*")
    .eq("id", auditId)
    .maybeSingle();

  if (!audit) return;
  if (audit.status !== "queued" && audit.status !== "running") return;

  try {
    const row = await claim(supabase, audit);
    if (!row) return; // claimed by another worker

    const { accessToken, kind } = await getFigmaToken(row.user_id);
    const variables = await resolveVariables(supabase, row, accessToken, kind);
    const store = await PostgresClassificationStore.create(
      row.user_id,
      row.file_key,
    );

    let lastWrite = 0;
    const writeProgress = async (
      stage: string,
      current: number,
      total: number,
      force = false,
    ) => {
      if (!force && now() - lastWrite < 600) return;
      lastWrite = now();
      await supabase
        .from("audits")
        .update({ progress: { stage, current, total } })
        .eq("id", auditId);
    };
    const onProgress = (stage: string, current: number, total: number) => {
      void writeProgress(stage, current, total);
    };

    // Prepare (network) or resume from a persisted checkpoint.
    let state: RunnerState;
    const stored = (row.runner_state ?? {}) as StoredRunnerState;
    if (stored.state?.componentOrder) {
      state = stored.state;
    } else {
      state = await prepareRunnerState({
        token: accessToken,
        tokenType: kind,
        fileKey: row.file_key,
        pageNames: row.selected_pages ?? [],
        variables,
        config: (row.config ?? {}) as AuditRunConfig,
        classificationStore: store,
        onProgress,
      });
      if (state.componentOrder.length > MAX_COMPONENTS) {
        throw new Error(
          `This file has ${state.componentOrder.length} components, over the ${MAX_COMPONENTS} limit. Audit fewer pages.`,
        );
      }
      await persistState(supabase, auditId, state);
    }

    while (!isRunComplete(state)) {
      state = await runAuditChunk(state, variables, chunkSize, onProgress);
      await persistState(supabase, auditId, state);
      await writeProgress(
        "auditing",
        state.cursor,
        state.componentOrder.length,
        true,
      );
      if (!isRunComplete(state) && now() - tick0 > budgetMs) {
        await refire(auditId);
        return;
      }
    }

    const result = finalizeRun(state);
    await writeResults(supabase, row, result);

    // Persist the resolved classifications so re-audits of this file reuse them.
    store.save(row.file_key, flattenClassifications(state.classifications));
    await store.flush();
  } catch (err) {
    await supabase
      .from("audits")
      .update({ status: "error", error_message: errorMessage(err) })
      .eq("id", auditId);
  }
}

/** Atomic queued→running claim, or lease refresh when resuming a running audit. */
async function claim(
  supabase: ServiceClient,
  audit: AuditRow,
): Promise<AuditRow | null> {
  const lease = { ...(audit.runner_state ?? {}), lease: new Date().toISOString() };
  if (audit.status === "queued") {
    const { data } = await supabase
      .from("audits")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
        runner_state: lease,
      })
      .eq("id", audit.id)
      .eq("status", "queued")
      .select()
      .maybeSingle();
    return data ?? null;
  }
  await supabase
    .from("audits")
    .update({ runner_state: lease })
    .eq("id", audit.id);
  return audit;
}

async function resolveVariables(
  supabase: ServiceClient,
  audit: AuditRow,
  accessToken: string,
  tokenType: "pat" | "oauth",
): Promise<Record<string, FigmaVariable>> {
  switch (audit.variable_source) {
    case "rest": {
      const client = new FigmaClient(accessToken, tokenType);
      return client.getFileVariables(audit.file_key);
    }
    case "plugin": {
      const { data } = await supabase
        .from("variable_uploads")
        .select("payload")
        .eq("audit_id", audit.id)
        .eq("consumed", true)
        .not("payload", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data?.payload) {
        throw new Error("Variables were not received from the plugin.");
      }
      return data.payload as Record<string, FigmaVariable>;
    }
    default:
      return {};
  }
}

async function persistState(
  supabase: ServiceClient,
  auditId: string,
  state: RunnerState,
): Promise<void> {
  const stored: StoredRunnerState = { state, lease: new Date().toISOString() };
  await supabase
    .from("audits")
    .update({ runner_state: stored as Record<string, unknown> })
    .eq("id", auditId);
}

async function writeResults(
  supabase: ServiceClient,
  audit: AuditRow,
  result: AuditFileResult,
): Promise<void> {
  const rows = result.components.map((c) => ({
    audit_id: audit.id,
    user_id: audit.user_id,
    component_name: c.componentName,
    page_name: c.pageName,
    score: c.score,
    result: c as unknown as Record<string, unknown>,
  }));

  if (rows.length > 0) {
    await supabase
      .from("audit_components")
      .upsert(rows, { onConflict: "audit_id,component_name" });
  }

  await supabase
    .from("audits")
    .update({
      status: "done",
      total_score: result.audit.totalScore,
      progress: {
        stage: "done",
        current: result.components.length,
        total: result.components.length,
      },
      runner_state: null,
    })
    .eq("id", audit.id);
}

function flattenClassifications(
  classifications: Record<string, Record<string, ComponentClassification>>,
): Record<string, ComponentClassification> {
  const flat: Record<string, ComponentClassification> = {};
  for (const [component, byCheck] of Object.entries(classifications)) {
    for (const [checkId, value] of Object.entries(byCheck)) {
      flat[`${component}:${checkId}`] = value;
    }
  }
  return flat;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (/403/.test(err.message)) {
      return "Figma denied access to this file's variables. Use the plugin or skip the token check.";
    }
    return err.message;
  }
  return "Audit failed unexpectedly.";
}

/**
 * Trigger the internal worker route. The route responds 202 immediately and
 * runs the audit via `after()`, so awaiting this only waits for the trigger to
 * be delivered (fast) — not for the audit to finish. Resolves even on failure;
 * the stale-run sweep recovers a worker that never started.
 */
export async function startWorker(auditId: string): Promise<void> {
  try {
    await fetch(`${getBaseUrl()}/api/audits/worker`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-worker-secret": getWorkerSecret(),
      },
      body: JSON.stringify({ auditId }),
    });
  } catch {
    // Best-effort; the stale-run sweep recovers a never-started worker.
  }
}

/** Flip `running` audits whose start exceeded the timeout to `error`. */
export async function sweepStaleAudits(): Promise<void> {
  const supabase = createServiceClient();
  const threshold = new Date(Date.now() - STALE_RUNNING_MS).toISOString();
  await supabase
    .from("audits")
    .update({
      status: "error",
      error_message: "Audit timed out — please retry.",
    })
    .eq("status", "running")
    .lt("started_at", threshold);
}
