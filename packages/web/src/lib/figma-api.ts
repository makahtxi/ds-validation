export type FigmaTokenKind = "pat" | "oauth";

interface FigmaUser {
  id: string;
  handle: string;
  img_url: string;
}

interface FigmaMeResponse {
  id: string;
  handle: string;
  img_url: string;
  email: string;
}

const FIGMA_API_BASE = "https://api.figma.com/v1";
const FIGMA_OAUTH_BASE = "https://www.figma.com";
const FIGMA_API_OAUTH_BASE = "https://api.figma.com";

function authHeader(token: string, kind: FigmaTokenKind): Record<string, string> {
  if (kind === "oauth") {
    return { Authorization: `Bearer ${token}` };
  }
  return { "X-Figma-Token": token };
}

export async function verifyFigmaToken(
  token: string,
  kind: FigmaTokenKind,
): Promise<FigmaUser> {
  const res = await fetch(`${FIGMA_API_BASE}/me`, {
    headers: authHeader(token, kind),
  });

  if (!res.ok) {
    throw new Response(JSON.stringify({ error: "Invalid Figma token" }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  const data = (await res.json()) as FigmaMeResponse;
  return {
    id: data.id,
    handle: data.handle,
    img_url: data.img_url,
  };
}

export async function exchangeOAuthCode(
  code: string,
  redirectUri: string,
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: string;
}> {
  const clientId = process.env.FIGMA_OAUTH_CLIENT_ID;
  const clientSecret = process.env.FIGMA_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Figma OAuth client ID or secret not configured");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
    grant_type: "authorization_code",
  });

  const res = await fetch(`${FIGMA_API_OAUTH_BASE}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Figma OAuth token exchange failed: ${body}`);
  }

  return res.json();
}

export async function refreshOAuthToken(
  refreshToken: string,
): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const clientId = process.env.FIGMA_OAUTH_CLIENT_ID;
  const clientSecret = process.env.FIGMA_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Figma OAuth client ID or secret not configured");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const res = await fetch(`${FIGMA_API_OAUTH_BASE}/api/oauth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Figma OAuth token refresh failed: ${body}`);
  }

  return res.json();
}

export async function revokeOAuthToken(token: string): Promise<void> {
  const clientId = process.env.FIGMA_OAUTH_CLIENT_ID;
  const clientSecret = process.env.FIGMA_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    token,
  });

  await fetch(`${FIGMA_API_OAUTH_BASE}/api/oauth/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
}

export function buildFigmaOAuthUrl(
  redirectUri: string,
  state: string,
): string {
  const clientId = process.env.FIGMA_OAUTH_CLIENT_ID;

  if (!clientId) {
    throw new Error("Figma OAuth client ID not configured");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "file_content:read",
    state,
    response_type: "code",
  });

  return `${FIGMA_OAUTH_BASE}/oauth?${params.toString()}`;
}
