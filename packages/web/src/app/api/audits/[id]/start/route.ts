import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startAudit, AuditError } from "@/lib/audit/service";
import { executeAudit } from "@/lib/audit/runner";
import type { VariableSource } from "@/lib/supabase/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
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

  let body: {
    pageNames?: string[];
    variableSource?: string;
    config?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.pageNames || !Array.isArray(body.pageNames) || body.pageNames.length === 0) {
    return NextResponse.json(
      { error: "pageNames must be a non-empty array" },
      { status: 400 },
    );
  }

  const validSources: VariableSource[] = ["rest-api", "plugin", "skip"];
  if (!body.variableSource || !validSources.includes(body.variableSource as VariableSource)) {
    return NextResponse.json(
      { error: `variableSource must be one of: ${validSources.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const { audit, pairingCode } = await startAudit(
      user.id,
      id,
      body.pageNames,
      body.variableSource as VariableSource,
      body.config,
    );

    executeAudit(id).catch((err) => {
      console.error(`Audit ${id} execution failed:`, err);
    });

    return NextResponse.json({
      id: audit.id,
      status: audit.status,
      pairingCode: pairingCode ?? null,
    });
  } catch (err) {
    if (err instanceof AuditError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode },
      );
    }
    return NextResponse.json(
      { error: "Failed to start audit" },
      { status: 500 },
    );
  }
}