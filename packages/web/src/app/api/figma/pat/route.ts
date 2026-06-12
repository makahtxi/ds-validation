import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyFigmaToken } from "@/lib/figma-api";
import { storePatConnection } from "@/lib/figma-token";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { pat: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const pat = typeof body.pat === "string" ? body.pat.trim() : "";
  if (!pat) {
    return NextResponse.json({ error: "PAT is required" }, { status: 400 });
  }

  let figmaUser: { id: string; handle: string; img_url: string };
  try {
    figmaUser = await verifyFigmaToken(pat, "pat");
  } catch {
    return NextResponse.json(
      { error: "Invalid personal access token" },
      { status: 422 },
    );
  }

  try {
    await storePatConnection(user.id, pat, figmaUser);
    return NextResponse.json({
      connected: true,
      kind: "pat",
      figmaUserHandle: figmaUser.handle,
      figmaUserImgUrl: figmaUser.img_url,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to store connection" },
      { status: 500 },
    );
  }
}
