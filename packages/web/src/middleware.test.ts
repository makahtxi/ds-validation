import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mockGetUser = vi.fn();
const mockGetAll = vi.fn();
const mockSet = vi.fn();

function mockNextUrl(path: string) {
  return {
    pathname: path,
    clone() {
      return new URL(`http://localhost:3000${path}`);
    },
    searchParams: new URL(`http://localhost:3000${path}`).searchParams,
  };
}

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    next: () => {
      const res = new Response(null, { status: 200 });
      return Object.assign(res, { cookies: { set: mockSet } });
    },
    redirect: (url: URL | string) => {
      return new Response(null, {
        status: 302,
        headers: { Location: typeof url === "string" ? url : url.toString() },
      });
    },
  },
}));

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAll.mockReturnValue([]);
  });

  function createRequest(path: string): Partial<NextRequest> {
    return {
      url: `http://localhost:3000${path}`,
      nextUrl: mockNextUrl(path) as unknown as NextRequest["nextUrl"],
      cookies: { getAll: mockGetAll } as unknown as NextRequest["cookies"],
    };
  }

  it("redirects unauthenticated users from /audits to /login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const { updateSession } = await import("@/lib/supabase/middleware");
    const res = await updateSession(createRequest("/audits/new") as NextRequest);

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("/login");
    expect(res.headers.get("Location")).toContain("returnTo");
  });

  it("redirects unauthenticated users from /settings to /login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const { updateSession } = await import("@/lib/supabase/middleware");
    const res = await updateSession(
      createRequest("/settings/connections") as NextRequest,
    );

    expect(res.status).toBe(302);
  });

  it("redirects unauthenticated users from /files to /login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const { updateSession } = await import("@/lib/supabase/middleware");
    const res = await updateSession(createRequest("/files/abc-123") as NextRequest);

    expect(res.status).toBe(302);
  });

  it("allows authenticated users to access app routes", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1", email: "a@b.com" } },
      error: null,
    });

    const { updateSession } = await import("@/lib/supabase/middleware");
    const res = await updateSession(createRequest("/audits/new") as NextRequest);

    expect(res.status).toBe(200);
  });

  it("allows unauthenticated access to /login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const { updateSession } = await import("@/lib/supabase/middleware");
    const res = await updateSession(createRequest("/login") as NextRequest);

    expect(res.status).toBe(200);
  });

  it("allows unauthenticated access to / (root)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const { updateSession } = await import("@/lib/supabase/middleware");
    const res = await updateSession(createRequest("/") as NextRequest);

    expect(res.status).toBe(200);
  });
});
