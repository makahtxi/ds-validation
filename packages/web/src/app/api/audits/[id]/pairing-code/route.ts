import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generatePairingCode } from "@/lib/audits/pairing";
import { PAIRING_CODE_TTL_MS } from "@/lib/audits/config";

export const runtime = "nodejs";

/**
 * Issue a short-lived single-use pairing code for the plugin handoff. The
 * designer enters this code in the DS Validation Figma plugin, which POSTs the
 * file's local variables to /api/variable-uploads.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: audit } = await service
    .from("audits")
    .select("id, user_id, file_key, status")
    .eq("id", id)
    .maybeSingle();

  if (!audit || audit.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (audit.status !== "draft") {
    return NextResponse.json(
      { error: "This audit can no longer be paired." },
      { status: 409 },
    );
  }

  // Drop any prior unconsumed codes so only one is active per audit.
  await service
    .from("variable_uploads")
    .delete()
    .eq("audit_id", id)
    .eq("consumed", false);

  const code = generatePairingCode();
  const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS).toISOString();

  const { error } = await service.from("variable_uploads").insert({
    user_id: user.id,
    audit_id: id,
    file_key: audit.file_key,
    pairing_code: code,
    expires_at: expiresAt,
  });

  if (error) {
    return NextResponse.json(
      { error: "Failed to create pairing code" },
      { status: 500 },
    );
  }

  return NextResponse.json({ code, expiresAt, fileKey: audit.file_key });
}
