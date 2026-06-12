import { describe, it, expect } from "vitest";
import { AuditError, validateTransition } from "./service";
import type { AuditStatus } from "../supabase/types";

describe("AuditError", () => {
  it("creates error with message and status code", () => {
    const err = new AuditError("test", 404);
    expect(err.message).toBe("test");
    expect(err.statusCode).toBe(404);
    expect(err.name).toBe("AuditError");
  });

  it("defaults to status code 400", () => {
    const err = new AuditError("bad request");
    expect(err.statusCode).toBe(400);
  });

  it("is instanceof Error", () => {
    const err = new AuditError("msg");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("validateTransition", () => {
  const validTransitions: [AuditStatus, AuditStatus][] = [
    ["draft", "queued"],
    ["draft", "error"],
    ["queued", "running"],
    ["queued", "error"],
    ["running", "done"],
    ["running", "error"],
    ["error", "queued"],
  ];

  for (const [from, to] of validTransitions) {
    it(`allows ${from} → ${to}`, () => {
      expect(() => validateTransition(from, to)).not.toThrow();
    });
  }

  const invalidTransitions: [AuditStatus, AuditStatus][] = [
    ["draft", "running"],
    ["draft", "done"],
    ["queued", "draft"],
    ["queued", "done"],
    ["running", "draft"],
    ["running", "queued"],
    ["done", "draft"],
    ["done", "queued"],
    ["done", "running"],
    ["done", "error"],
    ["error", "draft"],
    ["error", "running"],
    ["error", "done"],
  ];

  for (const [from, to] of invalidTransitions) {
    it(`rejects ${from} → ${to}`, () => {
      expect(() => validateTransition(from, to)).toThrow(AuditError);
    });
  }

  it("includes from/to in error message", () => {
    expect(() => validateTransition("done", "queued")).toThrow(
      "Cannot transition audit from done to queued",
    );
  });
});