import { describe, it, expect } from "vitest";
import { FigmaClient } from "./client";

describe("FigmaClient", () => {
  it("can be instantiated", () => {
    const client = new FigmaClient("test-token");
    expect(client).toBeDefined();
  });
});