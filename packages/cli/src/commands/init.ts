import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";

export function initCommand(): Command {
  const cmd = new Command("init");

  cmd
    .description("Generate a ds-validation.config.ts template")
    .action(() => {
      const configPath = path.resolve(process.cwd(), "ds-validation.config.ts");
      if (fs.existsSync(configPath)) {
        console.error("ds-validation.config.ts already exists. Remove it first if you want to regenerate.");
        process.exit(1);
      }

      const template = `import type { DSValidationConfig } from "@ds-validation/core";

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
`;

      fs.writeFileSync(configPath, template);
      console.log(`Created ds-validation.config.ts`);
    });

  return cmd;
}