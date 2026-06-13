// Minimal in-memory fixed-window rate limiter. Good enough for the single
// unauthenticated endpoint (plugin uploads); swap for Redis/Upstash if the app
// scales to multiple instances.

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }
  return { ok: true, retryAfterSeconds: 0 };
}

/** Test/maintenance helper. */
export function resetRateLimits(): void {
  buckets.clear();
}
