#!/usr/bin/env node
import { Command } from "commander";
import { auditCommand } from "./commands/audit.js";
import { reportCommand } from "./commands/report.js";
import { initCommand } from "./commands/init.js";

const program = new Command();

program
  .name("ds-validation")
  .description("Audit Figma design system files for token misuse")
  .version("0.0.1");

program.addCommand(auditCommand());
program.addCommand(reportCommand());
program.addCommand(initCommand());

program.parse();