import { describe, it, expect } from "vitest";
import { generatePairingCode, normalizePairingCode } from "./pairing";
import { PAIRING_CODE_ALPHABET, PAIRING_CODE_LENGTH } from "./config";

describe("generatePairingCode", () => {
  it("produces codes of the configured length from the safe alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generatePairingCode();
      expect(code).toHaveLength(PAIRING_CODE_LENGTH);
      for (const ch of code) expect(PAIRING_CODE_ALPHABET).toContain(ch);
    }
  });
});

describe("normalizePairingCode", () => {
  it("uppercases, trims, and removes whitespace", () => {
    expect(normalizePairingCode("  ab c12 ")).toBe("ABC12");
    expect(normalizePairingCode("xyz789")).toBe("XYZ789");
  });
});
