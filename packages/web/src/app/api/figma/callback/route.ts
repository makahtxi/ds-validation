import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeOAuthCode, verifyFigmaToken } from "@/lib/figma-api";
import { storeOAuthConnection } from "@/lib/figma-token";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      `${origin}/settings/connections?error=missing_params`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?returnTo=/settings/connections`);
  }

  const stateKey = `figma_oauth_state_${state}`;
  const cookieHeader = request.headers.get("cookie") ?? "";
  const stateCookie = cookieHeader
    .split("; ")
    .find((c) => c.startsWith(`${stateKey}=`));

  if (!stateCookie) {
    return NextResponse.redirect(
      `${origin}/settings/connections?error=invalid_state`,
    );
  }

  const returnTo = decodeURIComponent(stateCookie.split("=")[1] ?? "/settings/connections");

  let tokenData: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user_id: string;
  };

  try {
    const redirectUri = `${origin}/api/figma/callback`;
    tokenData = await exchangeOAuthCode(code, redirectUri);
  } catch {
    return NextResponse.redirect(
      `${origin}/settings/connections?error=token_exchange_failed`,
    );
  }

  try {
    const figmaUser = await verifyFigmaToken(tokenData.access_token, "oauth");
    await storeOAuthConnection(
      user.id,
      tokenData.access_token,
      tokenData.refresh_token,
      tokenData.expires_in,
      tokenData.user_id,
      ["file_content:read"],
    );

    const { updateUserInfo } = await import("@/lib/figma-token");
    await updateUserInfo(user.id, figmaUser.handle, figmaUser.img_url);
  } catch {
    return NextResponse.redirect(
      `${origin}/settings/connections?error=connection_failed`,
    );
  }

  const response = NextResponse.redirect(`${origin}${returnTo}`);

  response.cookies.set(stateKey, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
