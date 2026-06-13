import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { startWorker } from "@/lib/audits/run";

export const runtime = "nodejs";

type VariableSource = "rest" | "plugin" | "skip";

/**
 * Move a draft audit to `queued` and trigger the background worker. Enforces
 * one running audit per user (concurrency = 1).
 */
export async function POST(
  request: Request,
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

  let body: { selectedPages?: string[]; variableSource?: VariableSource };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const selectedPages = Array.isArray(body.selectedPages)
    ? body.selectedPages.filter((p): p is string => typeof p === "string")
    : [];
  if (selectedPages.length === 0) {
    return NextResponse.json(
      { error: "Select at least one page to audit." },
      { status: 400 },
    );
  }

  const variableSource = body.variableSource;
  if (!variableSource || !["rest", "plugin", "skip"].includes(variableSource)) {
    return NextResponse.json(
      { error: "Choose a variable source." },
      { status: 400 },
    );
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
  if (audit.status !== "draft") {
    return NextResponse.json(
      { error: "This audit has already been started." },
      { status: 409 },
    );
  }

  // Concurrency = 1: reject if the user already has an active audit.
  const { count: activeCount } = await service
    .from("audits")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("status", ["queued", "running"]);
  if ((activeCount ?? 0) > 0) {
    return NextResponse.json(
      { error: "You already have an audit running. Wait for it to finish." },
      { status: 409 },
    );
  }

  // For the plugin source, variables must already have been uploaded.
  if (variableSource === "plugin") {
    const { count } = await service
      .from("variable_uploads")
      .select("id", { count: "exact", head: true })
      .eq("audit_id", id)
      .eq("consumed", true);
    if ((count ?? 0) === 0) {
      return NextResponse.json(
        { error: "Waiting for the plugin to send variables." },
        { status: 409 },
      );
    }
  }

  // Conditional update doubles as a guard against a concurrent start.
  const { data: queued } = await service
    .from("audits")
    .update({
      status: "queued",
      selected_pages: selectedPages,
      variable_source: variableSource,
      progress: { stage: "queued", current: 0, total: 0 },
      error_message: null,
    })
    .eq("id", id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();

  if (!queued) {
    return NextResponse.json(
      { error: "This audit has already been started." },
      { status: 409 },
    );
  }

  await startWorker(id);

  return NextResponse.json({ status: "queued" });
}
