import { describe, it, expect } from "vitest";
import { generateCode } from "./pairing";

describe("generateCode", () => {
  it("generates a 6-character code", () => {
    const code = generateCode();
    expect(code).toHaveLength(6);
  });

  it("uses only allowed characters", () => {
    const allowed = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let i = 0; i < 50; i++) {
      const code = generateCode();
      for (const ch of code) {
        expect(allowed).toContain(ch);
      }
    }
  });

  it("generates different codes on successive calls", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateCode());
    }
    // With 30 possible chars and 6 positions, collisions are unlikely
    // but we still allow a few — just not too many
    expect(codes.size).toBeGreaterThan(90);
  });
});