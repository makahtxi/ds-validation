import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getConnectionStatus, disconnectFigma } from "@/lib/figma-token";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = await getConnectionStatus(user.id);
    return NextResponse.json(status);
  } catch {
    return NextResponse.json({ connected: false });
  }
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await disconnectFigma(user.id);
    return NextResponse.json({ connected: false });
  } catch {
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 },
    );
  }
}
