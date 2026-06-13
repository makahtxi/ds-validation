import { NextResponse } from "next/server";
import { FigmaClient } from "@ds-validation/figma";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getFigmaToken } from "@/lib/figma-token";

export const runtime = "nodejs";

/**
 * Probe whether the REST variables endpoint is available for this file (it is
 * Enterprise-only and 403s otherwise). The setup wizard uses this to enable or
 * grey out the "REST API" variable source.
 */
export async function GET(
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
    .select("user_id, file_key")
    .eq("id", id)
    .maybeSingle();

  if (!audit || audit.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { accessToken, kind } = await getFigmaToken(user.id);
    const client = new FigmaClient(accessToken, kind);
    const variables = await client.getFileVariables(audit.file_key);
    return NextResponse.json({ rest: true, variableCount: Object.keys(variables).length });
  } catch {
    // 403 (non-Enterprise) or any failure → REST not usable.
    return NextResponse.json({ rest: false, variableCount: 0 });
  }
}
