import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { ClassificationStore } from "@ds-validation/core";

/**
 * Shared test suite for any ClassificationStore implementation.
 * The Postgres-backed store in subtask 3 reuses this suite.
 */
export function runClassificationStoreTests(
  createStore: () => ClassificationStore,
  cleanup: () => void | Promise<void>,
): void {
  describe("ClassificationStore", () => {
    let store: ClassificationStore;

    beforeEach(() => {
      store = createStore();
    });

    afterEach(async () => {
      await cleanup();
    });

    it("load returns empty object for non-existent file", () => {
      expect(store.load("nonexistent")).toEqual({});
    });

    it("save + load round-trips decisions", () => {
      store.save("abc123", { "Button:state-variables": "interactive" });
      expect(store.load("abc123")).toEqual({ "Button:state-variables": "interactive" });
    });

    it("overwrites existing decisions on save", () => {
      store.save("abc123", { "Button:state-variables": "interactive" });
      store.save("abc123", { "Card:state-variables": "non-interactive" });
      expect(store.load("abc123")).toEqual({ "Card:state-variables": "non-interactive" });
    });

    it("handles empty decisions", () => {
      store.save("abc123", {});
      expect(store.load("abc123")).toEqual({});
    });

    it("isolates by fileKey", () => {
      store.save("file1", { "A:check": "interactive" });
      store.save("file2", { "B:check": "non-interactive" });
      expect(store.load("file1")).toEqual({ "A:check": "interactive" });
      expect(store.load("file2")).toEqual({ "B:check": "non-interactive" });
    });
  });
}
