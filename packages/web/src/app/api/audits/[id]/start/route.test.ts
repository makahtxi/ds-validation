import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeSupabase, type FakeSupabase } from "@/test-utils/fake-supabase";

let fake: FakeSupabase;
let currentUser: { id: string } | null = { id: "u1" };

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: currentUser } }) },
  }),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => fake,
}));
const startWorker = vi.fn(async (_id: string) => {});
vi.mock("@/lib/audits/run", () => ({ startWorker: (id: string) => startWorker(id) }));

import { POST } from "./route";

function call(body: unknown, id = "audit1") {
  return POST(
    new Request(`http://localhost/api/audits/${id}/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

function auditRow(over: Record<string, unknown> = {}) {
  return {
    id: "audit1",
    user_id: "u1",
    status: "draft",
    file_key: "F1",
    ...over,
  };
}

describe("POST /api/audits/[id]/start", () => {
  beforeEach(() => {
    currentUser = { id: "u1" };
    startWorker.mockClear();
    fake = createFakeSupabase({ audits: [auditRow()], variable_uploads: [] });
  });

  it("queues a draft audit and triggers the worker", async () => {
    const res = await call({ selectedPages: ["P"], variableSource: "skip" });
    expect(res.status).toBe(200);
    expect(fake.__tables.audits[0].status).toBe("queued");
    expect(fake.__tables.audits[0].selected_pages).toEqual(["P"]);
    expect(startWorker).toHaveBeenCalledWith("audit1");
  });

  it("rejects an unauthenticated request", async () => {
    currentUser = null;
    const res = await call({ selectedPages: ["P"], variableSource: "skip" });
    expect(res.status).toBe(401);
  });

  it("requires at least one page", async () => {
    const res = await call({ selectedPages: [], variableSource: "skip" });
    expect(res.status).toBe(400);
  });

  it("rejects starting a non-draft audit", async () => {
    fake = createFakeSupabase({ audits: [auditRow({ status: "done" })] });
    const res = await call({ selectedPages: ["P"], variableSource: "skip" });
    expect(res.status).toBe(409);
  });

  it("enforces one active audit per user (concurrency = 1)", async () => {
    fake = createFakeSupabase({
      audits: [
        auditRow(),
        auditRow({ id: "other", status: "running" }),
      ],
    });
    const res = await call({ selectedPages: ["P"], variableSource: "skip" });
    expect(res.status).toBe(409);
    expect(startWorker).not.toHaveBeenCalled();
  });

  it("blocks the plugin source until variables are uploaded", async () => {
    const res = await call({ selectedPages: ["P"], variableSource: "plugin" });
    expect(res.status).toBe(409);
  });

  it("allows the plugin source once an upload is consumed", async () => {
    fake = createFakeSupabase({
      audits: [auditRow()],
      variable_uploads: [
        { id: "up1", audit_id: "audit1", consumed: true, payload: {} },
      ],
    });
    const res = await call({ selectedPages: ["P"], variableSource: "plugin" });
    expect(res.status).toBe(200);
  });

  it("does not let one user start another user's audit", async () => {
    currentUser = { id: "intruder" };
    const res = await call({ selectedPages: ["P"], variableSource: "skip" });
    expect(res.status).toBe(404);
  });
});
