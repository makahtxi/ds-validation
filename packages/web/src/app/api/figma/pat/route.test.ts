import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockVerifyFigmaToken = vi.fn();
const mockStorePatConnection = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
    }),
  ),
}));

vi.mock("@/lib/figma-api", () => ({
  verifyFigmaToken: (...args: unknown[]) => mockVerifyFigmaToken(...args),
}));

vi.mock("@/lib/figma-token", () => ({
  storePatConnection: (...args: unknown[]) => mockStorePatConnection(...args),
}));

describe("figma PAT route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no user session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const { POST } = await import("@/app/api/figma/pat/route");

    const req = new Request("http://localhost:3000/api/figma/pat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pat: "figd_test" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when PAT is empty", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });

    const { POST } = await import("@/app/api/figma/pat/route");

    const req = new Request("http://localhost:3000/api/figma/pat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pat: "" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 422 when Figma rejects the token", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });

    mockVerifyFigmaToken.mockRejectedValue(new Error("403"));

    const { POST } = await import("@/app/api/figma/pat/route");

    const req = new Request("http://localhost:3000/api/figma/pat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pat: "figd_bad" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);

    const data = await res.json();
    expect(data.error).toContain("Invalid");
    expect(mockStorePatConnection).not.toHaveBeenCalled();
  });

  it("stores connection on valid PAT", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });

    mockVerifyFigmaToken.mockResolvedValue({
      id: "f1",
      handle: "designer",
      img_url: "https://img",
    });

    mockStorePatConnection.mockResolvedValue(undefined);

    const { POST } = await import("@/app/api/figma/pat/route");

    const req = new Request("http://localhost:3000/api/figma/pat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pat: "figd_valid" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.connected).toBe(true);
    expect(data.kind).toBe("pat");
    expect(data.figmaUserHandle).toBe("designer");
  });
});
