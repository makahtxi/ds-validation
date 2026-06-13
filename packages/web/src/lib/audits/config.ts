// Tunables for the audit execution service. Centralized so tests and routes
// share the same thresholds.

/** Components audited per resumable chunk. */
export const CHUNK_SIZE = 25;

/** Wall-clock budget for a single worker invocation before it re-fires itself.
 *  Kept under the route's maxDuration (300s) to leave margin for finalization. */
export const WORKER_BUDGET_MS = 240_000;

/** A `running` audit older than this (by started_at) is swept to `error`. */
export const STALE_RUNNING_MS = 10 * 60_000;

/** Hard cap on components in one audit — guards runner_state/jsonb size and
 *  function time. Exceeding it aborts the run with a friendly error. */
export const MAX_COMPONENTS = 2_000;

/** Max size of an uploaded variables payload (plugin handoff). */
export const VARIABLE_PAYLOAD_MAX_BYTES = 5 * 1024 * 1024;

/** Pairing-code lifetime and shape. */
export const PAIRING_CODE_TTL_MS = 10 * 60_000;
export const PAIRING_CODE_LENGTH = 6;
// Unambiguous alphabet (no 0/O/1/I) for codes a designer types by hand.
export const PAIRING_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Shared secret guarding the internal worker route. */
export function getWorkerSecret(): string {
  return process.env.WORKER_SECRET || "dev-worker-secret";
}

/** Absolute origin used for the worker self-invocation. */
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
