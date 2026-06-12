import { FigmaClient } from "@ds-validation/figma";
import { runAudit } from "@ds-validation/agent";
import type { FigmaVariable, ComponentClassification } from "@ds-validation/core";
import {
  updateAuditStatus,
  updateAuditProgress,
  saveAuditResults,
  loadClassifications,
  getPairingCodeByFileKey,
  AuditError,
} from "./service";
import { getFigmaToken } from "../figma-token";
import { createServiceClient } from "../supabase/service";
import type { AuditRow } from "../supabase/types";

const POLL_INTERVAL_MS = 3000;
const MAX_PLUGIN_WAIT_MS = 10 * 60 * 1000;

export async function executeAudit(auditId: string): Promise<void> {
  const supabase = createServiceClient();

  const { data: auditData, error: fetchError } = await supabase
    .from("audits")
    .select("*")
    .eq("id", auditId)
    .single();

  if (fetchError || !auditData) {
    console.error(`Audit ${auditId} not found for execution`);
    return;
  }

  const audit = auditData;

  if (audit.status !== "queued") {
    console.error(`Audit ${auditId} is not in queued state (status: ${audit.status})`);
    return;
  }

  await updateAuditStatus(auditId, "running");

  try {
    const { accessToken, kind } = await getFigmaToken(audit.user_id);

    const figmaClient = new FigmaClient(
      accessToken,
      kind === "oauth" ? "oauth" : "pat",
    );

    const pageNames: string[] = audit.selected_pages ?? [];
    const variableSource: string = audit.variable_source ?? "skip";

    await updateAuditProgress(auditId, {
      stage: "fetching-file",
      current: 0,
      total: 1,
      message: "Fetching file data...",
    });

    const { pages } = await figmaClient.getFileData(audit.file_key);

    await updateAuditProgress(auditId, {
      stage: "fetching-nodes",
      current: 0,
      total: pageNames.length,
      message: "Fetching component data...",
    });

    const selectedPages = pages.filter((p) => pageNames.includes(p.name));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const componentNodes = new Map<string, any>();
    const componentPageMap = new Map<string, string>();
    for (let i = 0; i < selectedPages.length; i++) {
      const page = selectedPages[i];
      const components = await figmaClient.getComponentNodesWithData(
        audit.file_key,
        page.id,
      );
      for (const comp of components) {
        componentNodes.set(comp.name, comp);
        componentPageMap.set(comp.name, page.name);
      }
      await updateAuditProgress(auditId, {
        stage: "fetching-nodes",
        current: i + 1,
        total: selectedPages.length,
        message: `Fetched page ${i + 1}/${selectedPages.length}...`,
      });
    }

    let variables: Record<string, FigmaVariable> = {};

    if (variableSource === "rest-api") {
      await updateAuditProgress(auditId, {
        stage: "fetching-variables",
        current: 0,
        total: 1,
        message: "Fetching variables via REST API...",
      });

      try {
        variables = await figmaClient.getFileVariables(audit.file_key);
      } catch (err) {
        if (err instanceof Error && err.message.includes("403")) {
          throw new AuditError(
            "Variables REST API access requires a Figma Enterprise plan. Please use the plugin pairing flow or skip variables.",
            403,
          );
        }
        throw err;
      }
    } else if (variableSource === "plugin") {
      await updateAuditProgress(auditId, {
        stage: "waiting-plugin",
        current: 0,
        total: 1,
        message: "Waiting for Figma plugin data...",
      });

      variables = await waitForPluginVariables(
        audit.user_id,
        audit.id,
        audit.file_key,
      );
    }

    const savedClassifications = await loadClassifications(
      audit.user_id,
      audit.file_key,
    );

    await updateAuditProgress(auditId, {
      stage: "auditing",
      current: 0,
      total: componentNodes.size,
      message: "Running conformance checks...",
    });

    const config = (audit.config ?? {}) as Record<string, unknown>;
    const checkOverrides: Record<string, { enabled?: boolean; weight?: number }> =
      (config.checkOverrides as Record<string, { enabled?: boolean; weight?: number }>) ?? {};
    const checkWeights: Record<string, number> | undefined =
      config.checkWeights as Record<string, number> | undefined;

    const variablesAvailable = Object.keys(variables).length > 0;
    if (!variablesAvailable) {
      checkOverrides["no-primitive-tokens"] = { enabled: false };
    }

    const result = await runAudit({
      token: accessToken,
      fileKey: audit.file_key,
      pageNames,
      variables,
      classifications: savedClassifications as unknown as Record<string, Record<string, ComponentClassification>>,
      config: {
        checkWeights,
        checkOverrides,
      },
      onProgress: (stage, current, total) => {
        updateAuditProgress(auditId, {
          stage,
          current,
          total,
          message: formatProgressMessage(stage, current, total),
        }).catch(console.error);
      },
    });

    const components = result.components.map((c) => ({
      componentName: c.componentName,
      pageName: c.pageName,
      score: c.score,
      result: c.checkResults as unknown as Record<string, unknown>,
    }));

    await saveAuditResults(auditId, result.audit.totalScore, components);
  } catch (err) {
    const message =
      err instanceof AuditError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unknown error";

    await updateAuditStatus(auditId, "error", {
      error_message: message,
    });
  }
}

async function waitForPluginVariables(
  userId: string,
  auditId: string,
  fileKey: string,
): Promise<Record<string, FigmaVariable>> {
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_PLUGIN_WAIT_MS) {
    await updateAuditProgress(auditId, {
      stage: "waiting-plugin",
      current: Math.floor((Date.now() - startTime) / 1000),
      total: Math.floor(MAX_PLUGIN_WAIT_MS / 1000),
      message: "Waiting for Figma plugin data...",
    });

    const status = await getPairingCodeByFileKey(userId, fileKey);

    if (!status) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      continue;
    }

    if (status.consumed && status.payload) {
      return status.payload as Record<string, FigmaVariable>;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new AuditError("Timed out waiting for plugin data. Please try again.", 408);
}

function formatProgressMessage(
  stage: string,
  current: number,
  total: number,
): string {
  switch (stage) {
    case "fetching-nodes":
      return `Fetching component data: page ${current}/${total}`;
    case "fetching-variables":
      return "Fetching design variables...";
    case "auditing":
      return `Running checks: component ${current}/${total}`;
    default:
      return `${stage}: ${current}/${total}`;
  }
}