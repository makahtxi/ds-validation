import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAudit } from "@/lib/audit/service";
import { createServiceClient } from "@/lib/supabase/service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: Request,
  { params }: RouteParams,
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const audit = await getAudit(user.id, id);
  if (!audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  const serviceClient = createServiceClient();
  const { data: components } = await serviceClient
    .from("audit_components")
    .select("component_name, page_name, score, result")
    .eq("audit_id", id);

  return NextResponse.json({
    id: audit.id,
    fileKey: audit.file_key,
    fileName: audit.file_name,
    status: audit.status,
    progress: audit.progress,
    selectedPages: audit.selected_pages,
    variableSource: audit.variable_source,
    totalScore: audit.total_score,
    errorMessage: audit.error_message,
    createdAt: audit.created_at,
    components: components ?? [],
  });
}