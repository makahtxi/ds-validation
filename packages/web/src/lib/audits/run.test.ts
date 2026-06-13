import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeSupabase, type FakeSupabase } from "@/test-utils/fake-supabase";

let fake: FakeSupabase;

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => fake,
}));
vi.mock("@/lib/figma-token", () => ({
  getFigmaToken: vi.fn(async () => ({ accessToken: "tok", kind: "oauth" })),
}));
vi.mock("./classification-store", () => ({
  PostgresClassificationStore: {
    create: vi.fn(async () => ({
      load: () => ({}),
      save: () => {},
      flush: async () => {},
    })),
  },
}));

// Stub the engine so the worker test exercises orchestration (claim, persist,
// chunk loop, refire, write-results), not the audit logic.
interface FakeState {
  componentOrder: string[];
  cursor: number;
  completed: { componentName: string; score: number; pageName: string }[];
  [k: string]: unknown;
}
vi.mock("@ds-validation/agent", () => {
  const ORDER = ["a", "b", "c", "d"];
  return {
    prepareRunnerState: vi.fn(
      async (): Promise<FakeState> => ({
        fileKey: "F",
        fileName: "File",
        pageNames: ["P"],
        componentOrder: ORDER,
        componentNodes: {},
        componentPageMap: {},
        classifications: {},
        cursor: 0,
        completed: [],
      }),
    ),
    runAuditChunk: vi.fn(
      async (
        state: FakeState,
        _vars: unknown,
        chunkSize: number,
      ): Promise<FakeState> => {
        const end = Math.min(state.cursor + chunkSize, state.componentOrder.length);
        const completed = [...state.completed];
        for (let i = state.cursor; i < end; i++) {
          completed.push({
            componentName: state.componentOrder[i],
            score: 90,
            pageName: "P",
          });
        }
        return { ...state, cursor: end, completed };
      },
    ),
    isRunComplete: (s: FakeState) => s.cursor >= s.componentOrder.length,
    finalizeRun: (s: FakeState) => ({
      audit: { totalScore: 84, components: [], meta: {} },
      components: s.completed,
    }),
  };
});

import { runAuditWorker, sweepStaleAudits } from "./run";

function draftRow(over: Record<string, unknown> = {}) {
  return {
    id: "audit1",
    user_id: "u1",
    file_key: "F",
    file_name: "File",
    status: "queued",
    progress: {},
    selected_pages: ["P"],
    variable_source: "skip",
    total_score: null,
    config: {},
    runner_state: null,
    error_message: null,
    started_at: null,
    ...over,
  };
}

describe("runAuditWorker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("claims, audits, and writes results to done", async () => {
    fake = createFakeSupabase({ audits: [draftRow()], audit_components: [] });

    await runAuditWorker("audit1", { chunkSize: 2, refire: vi.fn() });

    const audit = fake.__tables.audits[0];
    expect(audit.status).toBe("done");
    expect(audit.total_score).toBe(84);
    expect(audit.started_at).toBeTruthy();
    expect(fake.__tables.audit_components).toHaveLength(4);
    expect(fake.__tables.audit_components.map((c) => c.component_name)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("re-fires and resumes from the persisted checkpoint when killed mid-run", async () => {
    fake = createFakeSupabase({ audits: [draftRow()], audit_components: [] });
    const refire = vi.fn();

    // budgetMs -1 forces a hand-off after the first chunk.
    await runAuditWorker("audit1", { chunkSize: 1, budgetMs: -1, refire });

    expect(refire).toHaveBeenCalledTimes(1);
    const mid = fake.__tables.audits[0];
    expect(mid.status).toBe("running");
    expect((mid.runner_state as { state: { cursor: number } }).state.cursor).toBe(1);

    // Resume: a fresh invocation with a normal budget completes the run.
    await runAuditWorker("audit1", { refire: vi.fn() });
    const done = fake.__tables.audits[0];
    expect(done.status).toBe("done");
    expect(fake.__tables.audit_components).toHaveLength(4);
  });

  it("ignores audits that are not queued or running", async () => {
    fake = createFakeSupabase({ audits: [draftRow({ status: "draft" })] });
    await runAuditWorker("audit1", { refire: vi.fn() });
    expect(fake.__tables.audits[0].status).toBe("draft");
  });

  it("marks the audit errored when the runner throws", async () => {
    const agent = await import("@ds-validation/agent");
    (agent.prepareRunnerState as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("boom"),
    );
    fake = createFakeSupabase({ audits: [draftRow()] });

    await runAuditWorker("audit1", { refire: vi.fn() });
    const audit = fake.__tables.audits[0];
    expect(audit.status).toBe("error");
    expect(audit.error_message).toBe("boom");
  });
});

describe("sweepStaleAudits", () => {
  it("errors stale running audits and leaves fresh ones", async () => {
    const old = new Date(Date.now() - 60 * 60_000).toISOString();
    const fresh = new Date().toISOString();
    fake = createFakeSupabase({
      audits: [
        draftRow({ id: "stale", status: "running", started_at: old }),
        draftRow({ id: "fresh", status: "running", started_at: fresh }),
      ],
    });

    await sweepStaleAudits();

    const byId = (id: string) => fake.__tables.audits.find((a) => a.id === id);
    expect(byId("stale")?.status).toBe("error");
    expect(byId("fresh")?.status).toBe("running");
  });
});
