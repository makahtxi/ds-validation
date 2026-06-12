import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      exchangeCodeForSession: vi.fn(),
    },
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("auth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exchanges code for session and redirects on success", async () => {
    const mockExchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });
    const mockCreateClient = vi.fn().mockResolvedValue({
      auth: { exchangeCodeForSession: mockExchangeCodeForSession },
    });

    vi.mocked(
      (await import("@/lib/supabase/server")).createClient,
    ).mockImplementation(mockCreateClient);

    const { GET } = await import("@/app/auth/callback/route");

    const req = new Request(
      "http://localhost:3000/auth/callback?code=test-code",
    );

    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toBe("http://localhost:3000/");
  });

  it("redirects to login with error param on failure", async () => {
    const mockExchangeCodeForSession = vi.fn().mockResolvedValue({
      error: { message: "invalid" },
    });
    const mockCreateClient = vi.fn().mockResolvedValue({
      auth: { exchangeCodeForSession: mockExchangeCodeForSession },
    });

    vi.mocked(
      (await import("@/lib/supabase/server")).createClient,
    ).mockImplementation(mockCreateClient);

    const { GET } = await import("@/app/auth/callback/route");

    const req = new Request("http://localhost:3000/auth/callback?code=bad");

    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toContain("error");
  });

  it("redirects to login when no code provided", async () => {
    const mockCreateClient = vi.fn();

    vi.mocked(
      (await import("@/lib/supabase/server")).createClient,
    ).mockImplementation(mockCreateClient);

    const { GET } = await import("@/app/auth/callback/route");

    const req = new Request("http://localhost:3000/auth/callback");

    const res = await GET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toBe(
      "http://localhost:3000/login?error=auth_callback_failed",
    );
  });
});
