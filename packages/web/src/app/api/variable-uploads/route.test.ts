import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeSupabase, type FakeSupabase } from "@/test-utils/fake-supabase";

let fake: FakeSupabase;
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => fake,
}));

import { POST, OPTIONS } from "./route";
import { resetRateLimits } from "@/lib/audits/rate-limit";

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("http://localhost/api/variable-uploads", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

function seed(over: Record<string, unknown> = {}) {
  return createFakeSupabase({
    variable_uploads: [
      {
        id: "up1",
        user_id: "u1",
        audit_id: "audit1",
        file_key: "F1",
        pairing_code: "ABC123",
        payload: null,
        consumed: false,
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        ...over,
      },
    ],
  });
}

describe("POST /api/variable-uploads", () => {
  beforeEach(() => {
    resetRateLimits();
    fake = seed();
  });

  it("accepts a valid code and consumes the upload", async () => {
    const res = await post({ code: "abc123", fileKey: "F1", variables: { v: 1 } });
    expect(res.status).toBe(200);
    const row = fake.__tables.variable_uploads[0];
    expect(row.consumed).toBe(true);
    expect(row.payload).toEqual({ v: 1 });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("rejects an unknown code", async () => {
    const res = await post({ code: "NOPE99", fileKey: "F1", variables: {} });
    expect(res.status).toBe(404);
  });

  it("rejects an expired code", async () => {
    fake = seed({ expires_at: new Date(Date.now() - 1_000).toISOString() });
    const res = await post({ code: "ABC123", fileKey: "F1", variables: {} });
    expect(res.status).toBe(410);
  });

  it("rejects a file-key mismatch", async () => {
    const res = await post({ code: "ABC123", fileKey: "OTHER", variables: {} });
    expect(res.status).toBe(422);
  });

  it("rejects an already-consumed code", async () => {
    fake = seed({ consumed: true });
    const res = await post({ code: "ABC123", fileKey: "F1", variables: {} });
    expect(res.status).toBe(404);
  });

  it("rejects oversized payloads by content-length", async () => {
    const res = await post(
      { code: "ABC123", fileKey: "F1", variables: {} },
      { "content-length": String(10 * 1024 * 1024) },
    );
    expect(res.status).toBe(413);
  });

  it("rate-limits repeated bad attempts from one ip", async () => {
    let last = 200;
    for (let i = 0; i < 12; i++) {
      const res = await post(
        { code: "BADCODE", fileKey: "F1", variables: {} },
        { "x-forwarded-for": "1.2.3.4" },
      );
      last = res.status;
    }
    expect(last).toBe(429);
  });

  it("answers CORS preflight", () => {
    const res = OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });
});
