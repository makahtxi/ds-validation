import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { rateLimit, resetRateLimits } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    resetRateLimits();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to the limit then rejects with a retry hint", () => {
    expect(rateLimit("k", 2, 60_000).ok).toBe(true);
    expect(rateLimit("k", 2, 60_000).ok).toBe(true);
    const third = rateLimit("k", 2, 60_000);
    expect(third.ok).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    rateLimit("k", 1, 1_000);
    expect(rateLimit("k", 1, 1_000).ok).toBe(false);
    vi.advanceTimersByTime(1_001);
    expect(rateLimit("k", 1, 1_000).ok).toBe(true);
  });

  it("tracks keys independently", () => {
    expect(rateLimit("a", 1, 1_000).ok).toBe(true);
    expect(rateLimit("b", 1, 1_000).ok).toBe(true);
    expect(rateLimit("a", 1, 1_000).ok).toBe(false);
  });
});
