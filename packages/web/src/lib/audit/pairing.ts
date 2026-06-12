import { createServiceClient } from "../supabase/service";
import type { Database, Json } from "../supabase/types";

type VariableUploadInsert = Database["public"]["Tables"]["variable_uploads"]["Insert"];
type VariableUploadUpdate = Database["public"]["Tables"]["variable_uploads"]["Update"];

interface PairingCodeResult {
  code: string;
  expiresAt: string;
}

export async function createPairingCode(
  userId: string,
  fileKey: string,
): Promise<PairingCodeResult> {
  const supabase = createServiceClient();
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("variable_uploads")
    .insert({
      pairing_code: code,
      user_id: userId,
      file_key: fileKey,
      expires_at: expiresAt,
    } satisfies VariableUploadInsert);

  if (error) {
    if (error.code === "23505") {
      return createPairingCode(userId, fileKey);
    }
    throw new Error(`Failed to create pairing code: ${error.message}`);
  }

  return { code, expiresAt };
}

export async function consumePairingCodeWithPayload(
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
    throw new Error("Invalid pairing code");
  }

  if (data.consumed) {
    throw new Error("Pairing code already used");
  }

  if (new Date(data.expires_at) < new Date()) {
    throw new Error("Pairing code expired");
  }

  if (data.file_key !== fileKey) {
    throw new Error("File key mismatch");
  }

  const payloadStr = JSON.stringify(payload);
  if (payloadStr.length > 5 * 1024 * 1024) {
    throw new Error("Payload exceeds 5 MB limit");
  }

  const { error: updateError } = await supabase
    .from("variable_uploads")
    .update({
      consumed: true,
      payload: payload as Json,
    } satisfies VariableUploadUpdate)
    .eq("pairing_code", code);

  if (updateError) {
    throw new Error(`Failed to consume pairing code: ${updateError.message}`);
  }
}

export function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}