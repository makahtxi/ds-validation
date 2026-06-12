import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockExchangeOAuthCode = vi.fn();
const mockVerifyFigmaToken = vi.fn();
const mockStoreOAuthConnection = vi.fn();
const mockUpdateUserInfo = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
    }),
  ),
}));

vi.mock("@/lib/figma-api", () => ({
  exchangeOAuthCode: (...args: unknown[]) => mockExchangeOAuthCode(...args),
  verifyFigmaToken: (...args: unknown[]) => mockVerifyFigmaToken(...args),
}));

vi.mock("@/lib/figma-token", () => ({
  storeOAuthConnection: (...args: unknown[]) => mockStoreOAuthConnection(...args),
  updateUserInfo: (...args: unknown[]) => mockUpdateUserInfo(...args),
}));

describe("figma OAuth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to login when no user session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const { GET } = await import("@/app/api/figma/callback/route");

    const req = new Request(
      "http://localhost:3000/api/figma/callback?code=abc&state=xyz",
    );

    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toContain("/login");
  });

  it("redirects when code or state is missing", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });

    const { GET } = await import("@/app/api/figma/callback/route");

    const req = new Request("http://localhost:3000/api/figma/callback");

    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toContain("error=missing_params");
  });

  it("rejects calls with no state cookie (CSRF protection)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });

    const { GET } = await import("@/app/api/figma/callback/route");

    const req = new Request(
      "http://localhost:3000/api/figma/callback?code=abc&state=xyz",
    );

    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toContain("error=invalid_state");
  });

  it("exchanges code and stores connection on success", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });

    mockExchangeOAuthCode.mockResolvedValue({
      access_token: "at",
      refresh_token: "rt",
      expires_in: 3600,
      user_id: "f1",
    });

    mockVerifyFigmaToken.mockResolvedValue({
      id: "f1",
      handle: "designer",
      img_url: "https://img",
    });

    mockStoreOAuthConnection.mockResolvedValue(undefined);
    mockUpdateUserInfo.mockResolvedValue(undefined);

    const { GET } = await import("@/app/api/figma/callback/route");

    const req = new Request(
      "http://localhost:3000/api/figma/callback?code=abc&state=xyz",
      {
        headers: {
          cookie: "figma_oauth_state_xyz=%2Fsettings%2Fconnections",
        },
      },
    );

    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toBe(
      "http://localhost:3000/settings/connections",
    );
    expect(mockExchangeOAuthCode).toHaveBeenCalledWith(
      "abc",
      "http://localhost:3000/api/figma/callback",
    );
    expect(mockStoreOAuthConnection).toHaveBeenCalled();
    expect(mockUpdateUserInfo).toHaveBeenCalledWith(
      "u1",
      "designer",
      "https://img",
    );
  });

  it("handles token exchange failure", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });

    mockExchangeOAuthCode.mockRejectedValue(new Error("bad code"));

    const { GET } = await import("@/app/api/figma/callback/route");

    const req = new Request(
      "http://localhost:3000/api/figma/callback?code=bad&state=xyz",
      {
        headers: {
          cookie: "figma_oauth_state_xyz=%2Fsettings%2Fconnections",
        },
      },
    );

    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toContain(
      "error=token_exchange_failed",
    );
  });
});
