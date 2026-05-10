import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { loadClassifications, saveClassifications } from "./classification-store";

const TEST_DIR = path.join(process.cwd(), ".ds-validation-test");
const originalCwd = process.cwd;

describe("classification-store", () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
    process.cwd = () => TEST_DIR;
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    process.cwd = originalCwd;
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe("loadClassifications", () => {
    it("returns empty object for non-existent file", () => {
      const result = loadClassifications("nonexistent");
      expect(result).toEqual({});
    });

    it("returns decisions from existing file", () => {
      const storeDir = path.join(TEST_DIR, ".ds-validation");
      fs.mkdirSync(storeDir, { recursive: true });
      fs.writeFileSync(
        path.join(storeDir, "abc123-classifications.json"),
        JSON.stringify({
          fileKey: "abc123",
          decisions: { "Button:state-variables": "interactive" },
          updatedAt: new Date().toISOString(),
        }),
      );

      const result = loadClassifications("abc123");
      expect(result).toEqual({ "Button:state-variables": "interactive" });
    });

    it("returns empty object for corrupted file", () => {
      const storeDir = path.join(TEST_DIR, ".ds-validation");
      fs.mkdirSync(storeDir, { recursive: true });
      fs.writeFileSync(
        path.join(storeDir, "corrupted-classifications.json"),
        "not-valid-json",
      );

      const result = loadClassifications("corrupted");
      expect(result).toEqual({});
    });
  });

  describe("saveClassifications", () => {
    it("creates directory and writes file", () => {
      saveClassifications("abc123", { "Button:state-variables": "interactive" });

      const filePath = path.join(TEST_DIR, ".ds-validation", "abc123-classifications.json");
      expect(fs.existsSync(filePath)).toBe(true);

      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      expect(parsed.fileKey).toBe("abc123");
      expect(parsed.decisions).toEqual({ "Button:state-variables": "interactive" });
      expect(parsed.updatedAt).toBeDefined();
    });

    it("overwrites existing file", () => {
      saveClassifications("abc123", { "Button:state-variables": "interactive" });
      saveClassifications("abc123", { "Card:state-variables": "non-interactive" });

      const result = loadClassifications("abc123");
      expect(result).toEqual({ "Card:state-variables": "non-interactive" });
    });

    it("handles empty decisions", () => {
      saveClassifications("abc123", {});
      const result = loadClassifications("abc123");
      expect(result).toEqual({});
    });
  });
});
