import { createServiceClient } from "../supabase/service";
import type { Database, Json } from "../supabase/types";
import type { AuditStatus, VariableSource } from "../supabase/types";
import type { ComponentClassification } from "@ds-validation/core";

type AuditRow = Database["public"]["Tables"]["audits"]["Row"];
type AuditInsert = Database["public"]["Tables"]["audits"]["Insert"];
type AuditUpdate = Database["public"]["Tables"]["audits"]["Update"];

function generatePairingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export class AuditError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = "AuditError";
  }
}

export type { AuditStatus, VariableSource } from "../supabase/types";

const VALID_TRANSITIONS: Record<AuditStatus, AuditStatus[]> = {
  draft: ["queued", "error"],
  queued: ["running", "error"],
  running: ["done", "error"],
  done: [],
  error: ["queued"],
};

export function validateTransition(
  from: AuditStatus,
  to: AuditStatus,
): void {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new AuditError(
      `Cannot transition audit from ${from} to ${to}`,
      409,
    );
  }
}

export async function createDraft(
  userId: string,
  fileKey: string,
  fileName: string,
): Promise<AuditRow> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("audits")
    .insert({
      user_id: userId,
      file_key: fileKey,
      file_name: fileName,
      status: "draft",
    } satisfies AuditInsert)
    .select()
    .single();

  if (error) {
    throw new AuditError(`Failed to create audit draft: ${error.message}`, 500);
  }

  return data;
}

export async function getAudit(
  userId: string,
  auditId: string,
): Promise<AuditRow | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("audits")
    .select("*")
    .eq("id", auditId)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;
  return data;
}

export async function listAudits(userId: string): Promise<AuditRow[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("audits")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new AuditError(`Failed to list audits: ${error.message}`, 500);
  }

  return data ?? [];
}

export async function startAudit(
  userId: string,
  auditId: string,
  pageNames: string[],
  variableSource: VariableSource,
  config?: Record<string, unknown>,
): Promise<{ audit: AuditRow; pairingCode?: string }> {
  const audit = await getAudit(userId, auditId);

  if (!audit) {
    throw new AuditError("Audit not found", 404);
  }

  validateTransition(audit.status as AuditStatus, "queued");

  const supabase = createServiceClient();

  const { data: runningAudit } = await supabase
    .from("audits")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["queued", "running"])
    .maybeSingle();

  if (runningAudit) {
    throw new AuditError(
      "You already have an audit running. Please wait for it to complete.",
      409,
    );
  }

  let pairingCode: string | undefined;

  if (variableSource === "plugin") {
    pairingCode = await createPairingCodeEntry(userId, audit.file_key);
  }

  const update: AuditUpdate = {
    status: "queued",
    selected_pages: pageNames,
    variable_source: variableSource,
    config: (config ?? {}) as Json,
  };

  const { error } = await supabase
    .from("audits")
    .update(update)
    .eq("id", auditId);

  if (error) {
    throw new AuditError(`Failed to start audit: ${error.message}`, 500);
  }

  const updatedAudit = await getAudit(userId, auditId);
  return { audit: updatedAudit!, pairingCode };
}

export async function updateAuditStatus(
  auditId: string,
  status: AuditStatus,
  updates?: { total_score?: number; error_message?: string; progress?: Json },
): Promise<void> {
  const supabase = createServiceClient();

  const updateData: AuditUpdate = {
    status,
    ...updates,
  };

  const { error } = await supabase
    .from("audits")
    .update(updateData)
    .eq("id", auditId);

  if (error) {
    console.error(`Failed to update audit ${auditId} status to ${status}:`, error);
  }
}

export async function updateAuditProgress(
  auditId: string,
  progress: { stage: string; current: number; total: number; message?: string },
): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("audits")
    .update({ progress } satisfies AuditUpdate)
    .eq("id", auditId);

  if (error) {
    console.error(`Failed to update audit ${auditId} progress:`, error);
  }
}

export async function saveAuditResults(
  auditId: string,
  totalScore: number,
  components: Array<{
    componentName: string;
    pageName: string;
    score: number;
    result: Record<string, unknown>;
  }>,
): Promise<void> {
  const supabase = createServiceClient();

  const { error: auditError } = await supabase
    .from("audits")
    .update({
      status: "done",
      total_score: totalScore,
      progress: { stage: "done", current: 1, total: 1 },
    } satisfies AuditUpdate)
    .eq("id", auditId);

  if (auditError) {
    console.error(`Failed to save audit results for ${auditId}:`, auditError);
    return;
  }

  const componentRows = components.map((c) => ({
    audit_id: auditId,
    component_name: c.componentName,
    page_name: c.pageName,
    score: c.score,
    result: c.result as Json,
  }));

  const { error: compError } = await supabase
    .from("audit_components")
    .insert(componentRows);

  if (compError) {
    console.error(`Failed to save components for audit ${auditId}:`, compError);
  }
}

export async function cancelAudit(
  userId: string,
  auditId: string,
): Promise<AuditRow> {
  const audit = await getAudit(userId, auditId);

  if (!audit) {
    throw new AuditError("Audit not found", 404);
  }

  if (!["queued", "running"].includes(audit.status)) {
    throw new AuditError(`Cannot cancel audit in ${audit.status} state`, 409);
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("audits")
    .update({
      status: "error",
      error_message: "Cancelled by user",
    } satisfies AuditUpdate)
    .eq("id", auditId)
    .select()
    .single();

  if (error) {
    throw new AuditError(`Failed to cancel audit: ${error.message}`, 500);
  }

  return data;
}

export async function retriggerAudit(
  userId: string,
  auditId: string,
  pageNames: string[],
  variableSource: VariableSource,
): Promise<{ audit: AuditRow; pairingCode?: string }> {
  const audit = await getAudit(userId, auditId);

  if (!audit) {
    throw new AuditError("Audit not found", 404);
  }

  if (audit.status !== "error") {
    throw new AuditError("Can only retrigger failed audits", 409);
  }

  const supabase = createServiceClient();

  await supabase
    .from("audit_components")
    .delete()
    .eq("audit_id", auditId);

  return startAudit(userId, auditId, pageNames, variableSource);
}

async function createPairingCodeEntry(
  userId: string,
  fileKey: string,
): Promise<string> {
  const supabase = createServiceClient();

  const code = generatePairingCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("variable_uploads")
    .insert({
      pairing_code: code,
      user_id: userId,
      file_key: fileKey,
      expires_at: expiresAt,
    });

  if (error) {
    if (error.code === "23505") {
      return createPairingCodeEntry(userId, fileKey);
    }
    throw new AuditError(`Failed to create pairing code: ${error.message}`, 500);
  }

  return code;
}

export async function consumePairingCode(
  code: string,
  fileKey: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("variable_uploads")
    .select("*")
    .eq("pairing_code", code)
    .single();

  if (error || !data) {
    throw new AuditError("Invalid pairing code", 404);
  }

  if (data.consumed) {
    throw new AuditError("Pairing code already used", 410);
  }

  if (new Date(data.expires_at) < new Date()) {
    throw new AuditError("Pairing code expired", 410);
  }

  if (data.file_key !== fileKey) {
    throw new AuditError("Pairing code file key mismatch", 403);
  }

  const payloadSize = JSON.stringify(payload).length;
  if (payloadSize > 5 * 1024 * 1024) {
    throw new AuditError("Variable payload exceeds 5 MB limit", 413);
  }

  const { error: updateError } = await supabase
    .from("variable_uploads")
    .update({
      consumed: true,
      payload: payload as Json,
    })
    .eq("pairing_code", code);

  if (updateError) {
    throw new AuditError(
      `Failed to consume pairing code: ${updateError.message}`,
      500,
    );
  }
}

export async function getPairingCodeByFileKey(
  userId: string,
  fileKey: string,
): Promise<{
  pairingCode: string;
  consumed: boolean;
  payload: Record<string, unknown> | null;
} | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("variable_uploads")
    .select("pairing_code, consumed, payload")
    .eq("user_id", userId)
    .eq("file_key", fileKey)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    pairingCode: data.pairing_code,
    consumed: data.consumed,
    payload: data.payload as Record<string, unknown> | null,
  };
}

export async function getPairingCodeStatus(
  userId: string,
  code: string,
): Promise<{
  consumed: boolean;
  fileKey: string;
  payload: Record<string, unknown> | null;
} | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("variable_uploads")
    .select("consumed, file_key, payload")
    .eq("pairing_code", code)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  return {
    consumed: data.consumed,
    fileKey: data.file_key,
    payload: data.payload as Record<string, unknown> | null,
  };
}

export async function loadClassifications(
  userId: string,
  fileKey: string,
): Promise<Record<string, ComponentClassification>> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("classifications")
    .select("decisions")
    .eq("user_id", userId)
    .eq("file_key", fileKey)
    .single();

  if (error || !data) return {};
  return (data.decisions ?? {}) as Record<string, ComponentClassification>;
}

export async function saveClassifications(
  userId: string,
  fileKey: string,
  decisions: Record<string, ComponentClassification>,
): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("classifications")
    .upsert(
      {
        user_id: userId,
        file_key: fileKey,
        decisions: decisions as Json,
      },
      { onConflict: "user_id,file_key" },
    );

  if (error) {
    console.error(`Failed to save classifications for ${fileKey}:`, error);
  }
}