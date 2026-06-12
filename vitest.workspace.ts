import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/core",
  "packages/figma",
  "packages/agent",
  "packages/mcp",
  "packages/cli",
  "packages/web",
]);
