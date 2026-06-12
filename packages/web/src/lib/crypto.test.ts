import { describe, it, expect, beforeEach, vi } from "vitest";

const originalEnv = process.env;

function randomHexKey(): string {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("crypto helpers", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.TOKEN_ENCRYPTION_KEY = randomHexKey();
    vi.resetModules();
  });

  it("encrypts and decrypts a string round-trip", async () => {
    const { encrypt, decrypt } = await import("@/lib/crypto");
    const plaintext = "figd_abc123def456ghij";
    const ciphertext = encrypt(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(ciphertext).not.toContain(plaintext);
    const decrypted = decrypt(ciphertext);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertext for the same plaintext (random IV)", async () => {
    const { encrypt } = await import("@/lib/crypto");
    const plaintext = "figd_test_token";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
  });

  it("throws when decrypting with the wrong key", async () => {
    const { encrypt } = await import("@/lib/crypto");
    const ciphertext = encrypt("figd_token");

    process.env.TOKEN_ENCRYPTION_KEY = randomHexKey();
    vi.resetModules();

    const { decrypt } = await import("@/lib/crypto");
    expect(() => decrypt(ciphertext)).toThrow();
  });

  it("throws when TOKEN_ENCRYPTION_KEY is not set", async () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    vi.resetModules();

    const { encrypt } = await import("@/lib/crypto");
    expect(() => encrypt("test")).toThrow("TOKEN_ENCRYPTION_KEY is not set");
  });

  it("handles empty string round-trip", async () => {
    const { encrypt, decrypt } = await import("@/lib/crypto");
    const ciphertext = encrypt("");
    expect(decrypt(ciphertext)).toBe("");
  });
});
