import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizePairingCode } from "@/lib/audits/pairing";
import { VARIABLE_PAYLOAD_MAX_BYTES } from "@/lib/audits/config";
import { rateLimit } from "@/lib/audits/rate-limit";

export const runtime = "nodejs";

// The plugin runs inside a Figma iframe; its Origin is "null". Allow any origin
// (the request is authorized by the single-use pairing code, not a session).
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Max-Age": "86400",
};

function cors(json: unknown, init?: { status?: number }): NextResponse {
  return NextResponse.json(json, { status: init?.status ?? 200, headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Receive a variables payload from the DS Validation Figma plugin, authorized
 * by a single-use pairing code. Validates the code (exists, unexpired,
 * unconsumed), the file key, and the payload size, then attaches the variables
 * to the audit. No user session — the plugin has none.
 */
export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = rateLimit(`variable-uploads:${ip}`, 10, 60_000);
  if (!limit.ok) {
    return cors(
      { error: "Too many attempts. Try again shortly." },
      { status: 429 },
    );
  }

  // Reject oversized bodies before parsing when Content-Length is present.
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > VARIABLE_PAYLOAD_MAX_BYTES) {
    return cors({ error: "Variables payload is too large." }, { status: 413 });
  }

  const raw = await request.text();
  if (raw.length > VARIABLE_PAYLOAD_MAX_BYTES) {
    return cors({ error: "Variables payload is too large." }, { status: 413 });
  }

  let body: { code?: string; fileKey?: string; variables?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return cors({ error: "Invalid JSON" }, { status: 400 });
  }

  const code = body.code ? normalizePairingCode(body.code) : "";
  const fileKey = typeof body.fileKey === "string" ? body.fileKey : "";
  const variables = body.variables;
  if (!code || !fileKey || variables === null || typeof variables !== "object") {
    return cors(
      { error: "code, fileKey, and variables are required." },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const { data: upload } = await service
    .from("variable_uploads")
    .select("id, file_key, consumed, expires_at")
    .eq("pairing_code", code)
    .maybeSingle();

  if (!upload || upload.consumed) {
    return cors({ error: "Invalid or already-used code." }, { status: 404 });
  }
  if (new Date(upload.expires_at).getTime() <= Date.now()) {
    return cors({ error: "This code has expired. Generate a new one." }, { status: 410 });
  }
  if (upload.file_key !== fileKey) {
    return cors(
      { error: "This code is for a different Figma file." },
      { status: 422 },
    );
  }

  // Single-use: only consume if still unconsumed (guards a double POST).
  const { data: consumed } = await service
    .from("variable_uploads")
    .update({
      payload: variables as Record<string, unknown>,
      consumed: true,
    })
    .eq("id", upload.id)
    .eq("consumed", false)
    .select("id")
    .maybeSingle();

  if (!consumed) {
    return cors({ error: "Invalid or already-used code." }, { status: 404 });
  }

  return cors({ ok: true });
}
