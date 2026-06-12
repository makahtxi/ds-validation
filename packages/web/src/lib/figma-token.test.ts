import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFrom = vi.fn();
const mockSelectEq = vi.fn();
const mockSelectSingle = vi.fn();
const mockUpdateEq = vi.fn();
const mockDeleteEq = vi.fn();
const mockRefreshOAuthToken = vi.fn();
const mockRevokeOAuthToken = vi.fn();
const mockEncrypt = vi.fn();
const mockDecrypt = vi.fn();

const originalEnv = process.env;

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock("@/lib/crypto", () => ({
  encrypt: (v: string) => mockEncrypt(v),
  decrypt: (v: string) => mockDecrypt(v),
}));

vi.mock("@/lib/figma-api", () => ({
  refreshOAuthToken: (...args: unknown[]) => mockRefreshOAuthToken(...args),
  revokeOAuthToken: (...args: unknown[]) => mockRevokeOAuthToken(...args),
}));

describe("getFigmaToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.TOKEN_ENCRYPTION_KEY = "deadbeef".repeat(4);
    vi.resetModules();

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: mockSelectEq }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnValue({ eq: mockUpdateEq }),
      delete: vi.fn().mockReturnValue({ eq: mockDeleteEq }),
    });
    mockSelectEq.mockReturnValue({ single: mockSelectSingle });
    mockUpdateEq.mockResolvedValue({ data: null, error: null });
    mockDeleteEq.mockResolvedValue({ data: null, error: null });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns decrypted token when not near expiry", async () => {
    const futureDate = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    mockSelectSingle.mockResolvedValueOnce({
      data: {
        id: "conn-1",
        user_id: "u1",
        kind: "oauth",
        encrypted_access_token: "enc_at",
        encrypted_refresh_token: "enc_rt",
        expires_at: futureDate,
      },
      error: null,
    });

    mockDecrypt.mockReturnValue("decrypted_access_token");

    const { getFigmaToken } = await import("@/lib/figma-token");
    const result = await getFigmaToken("u1");

    expect(result.accessToken).toBe("decrypted_access_token");
    expect(result.kind).toBe("oauth");
    expect(mockDecrypt).toHaveBeenCalledWith("enc_at");
    expect(mockRefreshOAuthToken).not.toHaveBeenCalled();
  });

  it("refreshes token when near expiry", async () => {
    const nearExpiry = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    mockSelectSingle.mockResolvedValueOnce({
      data: {
        id: "conn-1",
        user_id: "u1",
        kind: "oauth",
        encrypted_access_token: "enc_old",
        encrypted_refresh_token: "enc_rt",
        expires_at: nearExpiry,
      },
      error: null,
    });

    mockDecrypt.mockImplementation((v: string) => {
      if (v === "enc_rt") return "refresh_token";
      if (v === "enc_old") return "old_token";
      if (v === "enc_new") return "new_token";
      return v;
    });

    mockEncrypt.mockReturnValue("enc_new");
    mockRefreshOAuthToken.mockResolvedValueOnce({
      access_token: "new_token",
      expires_in: 3600,
    });

    const { getFigmaToken } = await import("@/lib/figma-token");
    const result = await getFigmaToken("u1");

    expect(result.accessToken).toBe("new_token");
    expect(result.kind).toBe("oauth");
    expect(mockRefreshOAuthToken).toHaveBeenCalledWith("refresh_token");
    expect(mockEncrypt).toHaveBeenCalledWith("new_token");
  });

  it("throws when no connection found", async () => {
    mockSelectSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "not found" },
    });

    const { getFigmaToken } = await import("@/lib/figma-token");

    await expect(getFigmaToken("u1")).rejects.toThrow("No Figma connection found");
  });

  it("handles PAT connections (no refresh)", async () => {
    mockSelectSingle.mockResolvedValueOnce({
      data: {
        id: "conn-1",
        user_id: "u1",
        kind: "pat",
        encrypted_access_token: "enc_pat",
        encrypted_refresh_token: null,
        expires_at: null,
      },
      error: null,
    });

    mockDecrypt.mockReturnValue("figd_pat_token");

    const { getFigmaToken } = await import("@/lib/figma-token");
    const result = await getFigmaToken("u1");

    expect(result.accessToken).toBe("figd_pat_token");
    expect(result.kind).toBe("pat");
    expect(mockRefreshOAuthToken).not.toHaveBeenCalled();
  });
});
