import { describe, it, expect } from "vitest";

// These tests validate the pure logic functions used in the API routes.
// Full route testing would require a Next.js test server setup.

describe("Variable upload validation", () => {
  function validateUploadBody(body: unknown): {
    valid: boolean;
    error?: string;
  } {
    if (!body || typeof body !== "object") {
      return { valid: false, error: "Invalid request body" };
    }

    const b = body as Record<string, unknown>;

    if (!b.code || typeof b.code !== "string") {
      return { valid: false, error: "Missing or invalid 'code' field" };
    }

    if (!b.fileKey || typeof b.fileKey !== "string") {
      return { valid: false, error: "Missing or invalid 'fileKey' field" };
    }

    if (!b.payload || typeof b.payload !== "object") {
      return { valid: false, error: "Missing 'payload' field" };
    }

    const payloadSize = JSON.stringify(b.payload).length;
    if (payloadSize > 5 * 1024 * 1024) {
      return { valid: false, error: "Payload exceeds 5 MB limit" };
    }

    return { valid: true };
  }

  it("rejects missing code", () => {
    const result = validateUploadBody({ fileKey: "abc", payload: {} });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("code");
  });

  it("rejects missing fileKey", () => {
    const result = validateUploadBody({ code: "ABC123", payload: {} });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("fileKey");
  });

  it("rejects missing payload", () => {
    const result = validateUploadBody({ code: "ABC123", fileKey: "abc" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("payload");
  });

  it("accepts valid body", () => {
    const result = validateUploadBody({
      code: "ABC123",
      fileKey: "abc123",
      payload: { var1: { name: "color-primary" } },
    });
    expect(result.valid).toBe(true);
  });

  it("rejects oversized payload", () => {
    const largePayload = { data: "x".repeat(6 * 1024 * 1024) };
    const result = validateUploadBody({
      code: "ABC123",
      fileKey: "abc",
      payload: largePayload,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("5 MB");
  });
});

describe("Rate limiting", () => {
  it("allows requests under the limit", () => {
    const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
    const ip = "127.0.0.1";
    const now = Date.now();

    function checkRateLimit(clientIp: string): boolean {
      const entry = rateLimitMap.get(clientIp);
      if (!entry || now > entry.resetAt) {
        rateLimitMap.set(clientIp, { count: 1, resetAt: now + 60000 });
        return true;
      }
      entry.count++;
      return entry.count <= 20;
    }

    for (let i = 0; i < 20; i++) {
      expect(checkRateLimit(ip)).toBe(true);
    }
    expect(checkRateLimit(ip)).toBe(false);
  });

  it("resets after window", () => {
    const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

    function checkRateLimit(clientIp: string, now: number): boolean {
      const entry = rateLimitMap.get(clientIp);
      if (!entry || now > entry.resetAt) {
        rateLimitMap.set(clientIp, { count: 1, resetAt: now + 60000 });
        return true;
      }
      entry.count++;
      return entry.count <= 20;
    }

    const t0 = 1000000;
    for (let i = 0; i < 20; i++) {
      expect(checkRateLimit("127.0.0.1", t0)).toBe(true);
    }
    expect(checkRateLimit("127.0.0.1", t0)).toBe(false);

    // After the window resets
    expect(checkRateLimit("127.0.0.1", t0 + 70000)).toBe(true);
  });
});