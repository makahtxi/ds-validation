import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPairingCodeStatus } from "@/lib/audit/service";

interface RouteParams {
  params: Promise<{ code: string }>;
}

export async function GET(
  request: Request,
  { params }: RouteParams,
) {
  const { code } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getPairingCodeStatus(user.id, code.toUpperCase());

  if (!status) {
    return NextResponse.json(
      { consumed: false, hasVariables: false },
    );
  }

  return NextResponse.json({
    consumed: status.consumed,
    hasVariables: status.consumed && status.payload !== null,
  });
}