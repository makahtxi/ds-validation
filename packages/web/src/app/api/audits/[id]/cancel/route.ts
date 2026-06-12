import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cancelAudit, AuditError } from "@/lib/audit/service";

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

  try {
    const audit = await cancelAudit(user.id, id);
    return NextResponse.json({
      id: audit.id,
      status: audit.status,
      errorMessage: audit.error_message,
    });
  } catch (err) {
    if (err instanceof AuditError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode },
      );
    }
    return NextResponse.json(
      { error: "Failed to cancel audit" },
      { status: 500 },
    );
  }
}