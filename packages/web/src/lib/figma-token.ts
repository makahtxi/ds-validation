import { decrypt, encrypt } from "./crypto";
import { refreshOAuthToken, type FigmaTokenKind } from "./figma-api";
import { createServiceClient } from "./supabase/service";

interface FigmaConnectionRow {
  id: string;
  user_id: string;
  kind: FigmaTokenKind;
  encrypted_access_token: string;
  encrypted_refresh_token: string | null;
  expires_at: string | null;
}

class FigmaTokenRefreshError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FigmaTokenRefreshError";
  }
}

const REFRESH_WINDOW_MS = 5 * 60 * 1000;

const refreshLocks = new Map<string, Promise<FigmaConnectionRow>>();

async function refreshAccessToken(
  row: FigmaConnectionRow,
): Promise<FigmaConnectionRow> {
  if (!row.encrypted_refresh_token) {
    throw new FigmaTokenRefreshError("No refresh token available — please reconnect Figma");
  }

  const refreshToken = decrypt(row.encrypted_refresh_token);
  let data: { access_token: string; expires_in: number };

  try {
    data = await refreshOAuthToken(refreshToken);
  } catch (err) {
    throw new FigmaTokenRefreshError(
      `Figma token refresh failed — please reconnect. ${err instanceof Error ? err.message : ""}`,
    );
  }

  const encryptedAccessToken = encrypt(data.access_token);
  const expiresAt = new Date(
    Date.now() + data.expires_in * 1000,
  ).toISOString();

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("figma_connections")
    .update({
      encrypted_access_token: encryptedAccessToken,
      expires_at: expiresAt,
    })
    .eq("id", row.id);

  if (error) {
    throw new FigmaTokenRefreshError("Failed to persist refreshed token");
  }

  return {
    ...row,
    encrypted_access_token: encryptedAccessToken,
    expires_at: expiresAt,
  };
}

export async function getFigmaToken(userId: string): Promise<{
  accessToken: string;
  kind: FigmaTokenKind;
}> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("figma_connections")
    .select(
      "id, user_id, kind, encrypted_access_token, encrypted_refresh_token, expires_at",
    )
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error("No Figma connection found");
  }

  const row = data as unknown as FigmaConnectionRow;
  const shouldRefresh =
    row.kind === "oauth" &&
    row.expires_at &&
    new Date(row.expires_at).getTime() - Date.now() < REFRESH_WINDOW_MS;

  const effectiveRow = shouldRefresh
    ? await refreshWithLock(row)
    : row;

  const accessToken = decrypt(effectiveRow.encrypted_access_token);
  return { accessToken, kind: effectiveRow.kind };
}

async function refreshWithLock(
  row: FigmaConnectionRow,
): Promise<FigmaConnectionRow> {
  const existing = refreshLocks.get(row.user_id);
  if (existing) return existing;

  const promise = refreshAccessToken(row);
  refreshLocks.set(row.user_id, promise);

  try {
    return await promise;
  } finally {
    refreshLocks.delete(row.user_id);
  }
}

export async function storeOAuthConnection(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
  figmaUserId: string,
  scopes: string[],
): Promise<void> {
  const supabase = createServiceClient();
  const encryptedAccess = encrypt(accessToken);
  const encryptedRefresh = encrypt(refreshToken);
  const expiresAt = new Date(
    Date.now() + expiresIn * 1000,
  ).toISOString();

  const { error } = await supabase.from("figma_connections").upsert(
    {
      user_id: userId,
      kind: "oauth",
      encrypted_access_token: encryptedAccess,
      encrypted_refresh_token: encryptedRefresh,
      figma_user_id: figmaUserId,
      expires_at: expiresAt,
      granted_scopes: scopes,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error(`Failed to store Figma OAuth connection: ${error.message}`);
  }
}

export async function storePatConnection(
  userId: string,
  pat: string,
  figmaUser: { id: string; handle: string; img_url: string },
): Promise<void> {
  const supabase = createServiceClient();
  const encryptedAccess = encrypt(pat);

  const { error } = await supabase.from("figma_connections").upsert(
    {
      user_id: userId,
      kind: "pat",
      encrypted_access_token: encryptedAccess,
      figma_user_id: figmaUser.id,
      figma_user_handle: figmaUser.handle,
      figma_user_img_url: figmaUser.img_url,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error(`Failed to store PAT connection: ${error.message}`);
  }
}

export async function getConnectionStatus(userId: string): Promise<{
  connected: boolean;
  kind?: FigmaTokenKind;
  figmaUserHandle?: string;
  figmaUserImgUrl?: string;
  grantedScopes?: string[];
}> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("figma_connections")
    .select("kind, figma_user_handle, figma_user_img_url, granted_scopes")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return { connected: false };
  }

  return {
    connected: true,
    kind: data.kind as FigmaTokenKind,
    figmaUserHandle: data.figma_user_handle ?? undefined,
    figmaUserImgUrl: data.figma_user_img_url ?? undefined,
    grantedScopes: data.granted_scopes ?? undefined,
  };
}

export async function disconnectFigma(userId: string): Promise<void> {
  const supabase = createServiceClient();

  const { data: row } = await supabase
    .from("figma_connections")
    .select("kind, encrypted_access_token, encrypted_refresh_token")
    .eq("user_id", userId)
    .single();

  if (row?.kind === "oauth" && row.encrypted_access_token) {
    try {
      const token = decrypt(row.encrypted_access_token);
      const { revokeOAuthToken } = await import("./figma-api");
      await revokeOAuthToken(token);
    } catch {
      // Revocation is best-effort
    }
  }

  const { error } = await supabase
    .from("figma_connections")
    .delete()
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to disconnect Figma: ${error.message}`);
  }
}

export async function updateUserInfo(
  userId: string,
  handle: string,
  imgUrl: string,
): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("figma_connections")
    .update({ figma_user_handle: handle, figma_user_img_url: imgUrl })
    .eq("user_id", userId);
}
