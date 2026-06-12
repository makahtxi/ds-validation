import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { FileClassificationStore, loadClassifications, saveClassifications } from "./classification-store";
import { runClassificationStoreTests } from "./classification-store.test-shared";

const TEST_DIR = path.join(process.cwd(), ".ds-validation-test");

function rmTestDir() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }
}

// Run the shared interface test suite
runClassificationStoreTests(
  () => {
    rmTestDir();
    return new FileClassificationStore(TEST_DIR);
  },
  () => rmTestDir(),
);

describe("FileClassificationStore", () => {
  beforeEach(() => {
    rmTestDir();
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmTestDir();
  });

  it("load returns empty object when JSON is corrupt", () => {
    const store = new FileClassificationStore(TEST_DIR);
    const storeDir = path.join(TEST_DIR, ".ds-validation");
    fs.mkdirSync(storeDir, { recursive: true });
    fs.writeFileSync(
      path.join(storeDir, "corrupted-classifications.json"),
      "not-valid-json",
    );
    expect(store.load("corrupted")).toEqual({});
  });

  it("uses cwd when no directory given", () => {
    const store = new FileClassificationStore();
    expect(store).toBeDefined();
  });
});

describe("deprecated load/save functions", () => {
  const originalCwd = process.cwd;

  beforeEach(() => {
    process.cwd = () => TEST_DIR;
    rmTestDir();
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    process.cwd = originalCwd;
    rmTestDir();
  });

  it("loadClassifications returns empty for non-existent file", () => {
    expect(loadClassifications("nonexistent")).toEqual({});
  });

  it("saveClassifications + loadClassifications round-trip", () => {
    saveClassifications("abc123", { "Button:state-variables": "interactive" });
    const result = loadClassifications("abc123");
    expect(result).toEqual({ "Button:state-variables": "interactive" });
  });

  it("loadClassifications returns empty for corrupt file", () => {
    const storeDir = path.join(TEST_DIR, ".ds-validation");
    fs.mkdirSync(storeDir, { recursive: true });
    fs.writeFileSync(
      path.join(storeDir, "corrupt-classifications.json"),
      "not-valid-json",
    );
    expect(loadClassifications("corrupt")).toEqual({});
  });

  it("saveClassifications overwrites existing file", () => {
    saveClassifications("abc123", { "Button:state-variables": "interactive" });
    saveClassifications("abc123", { "Card:state-variables": "non-interactive" });
    expect(loadClassifications("abc123")).toEqual({ "Card:state-variables": "non-interactive" });
  });
});
