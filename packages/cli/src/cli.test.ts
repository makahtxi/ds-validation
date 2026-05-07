import { describe, it, expect } from "vitest";
import { parseFileKey } from "./utils.js";

describe("parseFileKey", () => {
  it("extracts file key from figma design URL", () => {
    expect(parseFileKey("https://www.figma.com/design/abc123/My-File")).toBe("abc123");
  });

  it("extracts file key from figma file URL", () => {
    expect(parseFileKey("https://www.figma.com/file/xyz789/My-File")).toBe("xyz789");
  });

  it("returns raw key for standalone key", () => {
    expect(parseFileKey("abc123")).toBe("abc123");
  });

  it("returns null for invalid URL", () => {
    expect(parseFileKey("https://www.google.com")).toBeNull();
  });
});