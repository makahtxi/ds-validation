import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sweepStaleAudits } from "@/lib/audits/run";

export const runtime = "nodejs";

/**
 * Read an audit's status + progress (polled by the wizard). Runs the lazy
 * stale-running sweep so timed-out audits self-heal to `error`.
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

  await sweepStaleAudits();

  const service = createServiceClient();
  const { data: audit } = await service
    .from("audits")
    .select(
      "id, user_id, file_key, file_name, status, progress, selected_pages, variable_source, total_score, error_message",
    )
    .eq("id", id)
    .maybeSingle();

  if (!audit || audit.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Whether the plugin has delivered variables for this audit (wizard waits on this).
  const { count } = await service
    .from("variable_uploads")
    .select("id", { count: "exact", head: true })
    .eq("audit_id", id)
    .eq("consumed", true);

  return NextResponse.json({
    id: audit.id,
    status: audit.status,
    progress: audit.progress,
    fileKey: audit.file_key,
    fileName: audit.file_name,
    selectedPages: audit.selected_pages,
    variableSource: audit.variable_source,
    totalScore: audit.total_score,
    errorMessage: audit.error_message,
    variableUploadReceived: (count ?? 0) > 0,
  });
}
