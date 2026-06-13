import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeSupabase, type FakeSupabase } from "@/test-utils/fake-supabase";

let fake: FakeSupabase;
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => fake,
}));

import { PostgresClassificationStore } from "./classification-store";

describe("PostgresClassificationStore", () => {
  beforeEach(() => {
    fake = createFakeSupabase({
      classifications: [
        {
          user_id: "u1",
          file_key: "F1",
          decisions: { "Button:state-variables": "interactive" },
        },
      ],
    });
  });

  it("preloads and returns the file's decisions synchronously", async () => {
    const store = await PostgresClassificationStore.create("u1", "F1");
    expect(store.load("F1")).toEqual({
      "Button:state-variables": "interactive",
    });
    expect(store.loadWasHit).toBe(true);
  });

  it("returns empty decisions for a different file key", async () => {
    const store = await PostgresClassificationStore.create("u1", "F1");
    expect(store.load("OTHER")).toEqual({});
  });

  it("returns empty when nothing is stored", async () => {
    const store = await PostgresClassificationStore.create("u2", "F2");
    expect(store.load("F2")).toEqual({});
  });

  it("buffers saves and upserts them on flush", async () => {
    const store = await PostgresClassificationStore.create("u2", "F2");
    store.save("F2", { "Card:hardcoded-colors": "non-interactive" });
    await store.flush();

    const row = fake.__tables.classifications.find(
      (r) => r.user_id === "u2" && r.file_key === "F2",
    );
    expect(row?.decisions).toEqual({
      "Card:hardcoded-colors": "non-interactive",
    });
  });

  it("flush is a no-op when nothing was saved", async () => {
    const store = await PostgresClassificationStore.create("u1", "F1");
    await expect(store.flush()).resolves.toBeUndefined();
  });
});
