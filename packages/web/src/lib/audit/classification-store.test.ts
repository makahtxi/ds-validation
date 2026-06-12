import { describe, it, expect } from "vitest";
import { PostgresClassificationStore } from "./classification-store";

describe("PostgresClassificationStore", () => {
  it("starts with empty cache", () => {
    const store = new PostgresClassificationStore({
      userId: "user-1",
      fileKey: "abc123",
    });

    const result = store.load("abc123");
    expect(result).toEqual({});
  });

  it("returns empty for a different file key", () => {
    const store = new PostgresClassificationStore({
      userId: "user-1",
      fileKey: "abc123",
    });

    const result = store.load("different-key");
    expect(result).toEqual({});
  });

  it("saves decisions to cache", () => {
    const store = new PostgresClassificationStore({
      userId: "user-1",
      fileKey: "abc123",
    });

    const decisions = {
      "Button:hardcoded-colors": "interactive" as const,
      "Card:state-variables": "non-interactive" as const,
    };

    store.save("abc123", decisions);

    const loaded = store.load("abc123");
    expect(loaded).toEqual(decisions);
  });

  it("overwrites decisions on subsequent save", () => {
    const store = new PostgresClassificationStore({
      userId: "user-1",
      fileKey: "abc123",
    });

    store.save("abc123", {
      "Button:hardcoded-colors": "interactive" as const,
    });

    store.save("abc123", {
      "Card:state-variables": "non-interactive" as const,
    });

    const loaded = store.load("abc123");
    expect(loaded).toEqual({
      "Card:state-variables": "non-interactive",
    });
  });

  it("does not save to a different file key", () => {
    const store = new PostgresClassificationStore({
      userId: "user-1",
      fileKey: "abc123",
    });

    store.save("other-key", {
      "Button:hardcoded-colors": "interactive" as const,
    });

    const result = store.load("abc123");
    expect(result).toEqual({});
  });

  it("tracks dirty state", () => {
    const store = new PostgresClassificationStore({
      userId: "user-1",
      fileKey: "abc123",
    });

    expect(store.isDirty).toBe(false);

    store.save("abc123", {
      "Button:hardcoded-colors": "interactive" as const,
    });

    expect(store.isDirty).toBe(true);
  });

  it("setCache populates cache without marking dirty", () => {
    const store = new PostgresClassificationStore({
      userId: "user-1",
      fileKey: "abc123",
    });

    store.setCache({
      "Button:hardcoded-colors": "interactive" as const,
    });

    expect(store.load("abc123")).toEqual({
      "Button:hardcoded-colors": "interactive",
    });
    expect(store.isDirty).toBe(false);
  });
});