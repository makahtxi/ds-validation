import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

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
    .select("id, user_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!audit || audit.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!["queued", "running"].includes(audit.status)) {
    return NextResponse.json(
      { error: "Only queued or running audits can be cancelled." },
      { status: 409 },
    );
  }

  // Conditional update guards against a race with the worker completing.
  const { data: cancelled } = await service
    .from("audits")
    .update({ status: "error", error_message: "Cancelled by user." })
    .eq("id", id)
    .in("status", ["queued", "running"])
    .select("id, status")
    .maybeSingle();

  if (!cancelled) {
    return NextResponse.json(
      { error: "Audit is no longer cancellable." },
      { status: 409 },
    );
  }

  return NextResponse.json({ id: cancelled.id, status: cancelled.status });
}
