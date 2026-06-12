import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildFigmaOAuthUrl } from "@/lib/figma-api";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams, origin } = new URL(request.url);
  const returnTo = searchParams.get("returnTo") ?? "/settings/connections";

  const state = crypto.randomUUID();
  const stateKey = `figma_oauth_state_${state}`;

  const redirectUri = `${origin}/api/figma/callback`;

  const url = buildFigmaOAuthUrl(redirectUri, state);

  const response = NextResponse.redirect(url);

  response.cookies.set(stateKey, returnTo, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}
