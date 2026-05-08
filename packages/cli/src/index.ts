#!/usr/bin/env node
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { Command } from "commander";
import { auditCommand } from "./commands/audit.js";
import { reportCommand } from "./commands/report.js";
import { initCommand } from "./commands/init.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, "../../../.env") });
config({ path: resolve(process.cwd(), ".env") });

const program = new Command();

program
  .name("ds-validation")
  .description("Audit Figma design system files for token misuse")
  .version("0.0.1");

program.addCommand(auditCommand());
program.addCommand(reportCommand());
program.addCommand(initCommand());

program.parse();