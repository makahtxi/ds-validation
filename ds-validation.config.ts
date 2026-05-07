import type { DSValidationConfig } from "@ds-validation/core";

const config: DSValidationConfig = {
  figma: {
    // fileKey: "your-figma-file-key",
    // accessToken: process.env.FIGMA_ACCESS_TOKEN,
  },
  checks: {
    "hardcoded-colors": { weight: 0.25, enabled: true },
    "hardcoded-spacing": { weight: 0.15, enabled: true },
    "hardcoded-text-styles": { weight: 0.2, enabled: true },
    "no-primitive-tokens": { weight: 0.25, enabled: true },
    "state-variables": { weight: 0.15, enabled: true },
  },
  ai: {
    // model: "gpt-4o",
    // apiKey: process.env.OPENAI_API_KEY,
  },
  output: {
    dir: "./output",
  },
};

export default config;
