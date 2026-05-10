import { Command } from "commander";
import prompts from "prompts";
import { FigmaClient } from "@ds-validation/figma";
import { auditFile, registry } from "@ds-validation/agent";
import { McpVariableClient } from "@ds-validation/mcp";
import {
  writeAuditResult,
  loadAuditResult,
  writeComponentResult,
  mergeAuditResults,
  buildComponentSummary,
  type FigmaNode,
  type FigmaVariable,
  type AuditResult,
  type ComponentClassification,
  type ClassificationOverride,
} from "@ds-validation/core";
import { parseFileKey } from "../utils.js";
import { collectAmbiguousComponents, loadClassifications, saveClassifications } from "@ds-validation/agent";
import { loadConfig } from "../config.js";

export function auditCommand(): Command {
  const cmd = new Command("audit");

  cmd
    .description("Audit a Figma design system file")
    .argument("<figma-url>", "Figma file URL")
    .option("-k, --api-key <key>", "Figma API key (or set FIGMA_ACCESS_TOKEN)")
    .option("--variable-source <source>", "How to fetch variables: rest-api, mcp, or skip", "rest-api")
    .option("--mcp-command <command>", "MCP server command (default: npx -y figma-console-mcp@latest)", "npx")
    .option("--mcp-args <args>", "MCP server args (comma-separated)", "-y,figma-console-mcp@latest,--stdio")
    .option("-o, --output <dir>", "Output directory", "./output")
    .option(
      "--pages <pages>",
      "Comma-separated page names to audit (skip interactive selection)",
    )
    .option("--debug", "Enable debug logging for MCP and other internals", false)
    .action(
      async (
        figmaUrl: string,
        options: {
          apiKey?: string;
          variableSource: string;
          mcpCommand: string;
          mcpArgs: string;
          output: string;
          pages?: string;
          debug?: boolean;
        },
      ) => {
          if (options.debug) {
            process.env.DS_VALIDATION_DEBUG = "1";
          }

          const config = loadConfig();

          const fileKey = parseFileKey(figmaUrl);
          if (!fileKey) {
            console.error(
              "Could not parse Figma file key from URL. Expected format: https://www.figma.com/design/<fileKey>/...",
            );
            process.exit(1);
          }

          const figmaToken =
            options.apiKey ?? process.env.FIGMA_ACCESS_TOKEN;
          if (!figmaToken) {
            console.error(
              "Figma access token required. Set FIGMA_ACCESS_TOKEN env var or pass --api-key.",
            );
            process.exit(1);
          }

          const variableSource = options.variableSource as "rest-api" | "mcp" | "skip";

          // Only prompt if user didn't explicitly specify --variable-source
          const userSpecifiedVariableSource = process.argv.includes('--variable-source');
          let finalVariableSource = variableSource;
          
          if (!userSpecifiedVariableSource) {
            // Check if we should prompt
            const response = await prompts({
              type: "select",
              name: "source",
              message: "How should I fetch Figma Variables?",
              choices: [
                { title: "REST API (requires file_variables:read scope)", value: "rest-api" },
                { title: "MCP server (uses figma-console-mcp, no special scope needed)", value: "mcp" },
                { title: "Skip variables (primitive token check will be disabled)", value: "skip" },
              ],
              initial: 1,
            });
            if (response.source) {
              finalVariableSource = response.source;
            } else {
              finalVariableSource = "skip";
            }
          }

          const figmaClient = new FigmaClient(figmaToken);

          console.log(`Fetching Figma file: ${fileKey}...`);
          const fileMeta = await figmaClient.getFileMeta(fileKey);
          console.log(`File: ${fileMeta.name}`);

          const allPages = await figmaClient.getFilePages(fileKey);

          let selectedPageNames: string[];
          if (options.pages) {
            selectedPageNames = options.pages.split(",").map((p: string) => p.trim());
          } else {
            console.log("\nPages found:");
            for (const page of allPages) {
              console.log(
                `  ${page.name} (${page.componentCount} components)`,
              );
            }

            const response = await prompts({
              type: "multiselect",
              name: "pages",
              message: "Select pages to audit",
              choices: allPages.map((p) => ({
                title: `${p.name} (${p.componentCount} components)`,
                value: p.name,
              })),
            });

            if (!response.pages || response.pages.length === 0) {
              console.log("No pages selected. Exiting.");
              return;
            }
            selectedPageNames = response.pages as string[];
          }

          const selectedPages = allPages.filter((p) =>
            selectedPageNames.includes(p.name),
          );

          console.log("\nFetching styles...");
          const styles = await figmaClient.getFileStyles(fileKey);
          console.log(`  Found ${Object.keys(styles).length} styles`);

          console.log("\nFetching variables...");
          let variables: Record<string, FigmaVariable> = {};
          let variablesAvailable = false;

          if (finalVariableSource === "skip") {
            console.log("  Skipping variables (user choice).");
            console.log("  Note: The \"No Primitive Tokens\" check will be skipped.");
          } else if (finalVariableSource === "mcp") {
            console.log("  Fetching variables via MCP server...");
            const mcpArgs = options.mcpArgs.split(",").map((a: string) => a.trim());
            const mcpClient = new McpVariableClient({
              command: options.mcpCommand,
              args: mcpArgs,
              figmaApiKey: figmaToken,
            });

            try {
              variables = await mcpClient.getVariables(figmaUrl);
              variablesAvailable = Object.keys(variables).length > 0;
              console.log(`  Found ${Object.keys(variables).length} variables (via MCP)`);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.warn(`  MCP variable fetch failed: ${msg}`);
              console.warn("  Falling back to REST API...");
              try {
                variables = await figmaClient.getFileVariables(fileKey);
                variablesAvailable = Object.keys(variables).length > 0;
                console.log(`  Found ${Object.keys(variables).length} variables (via REST API)`);
              } catch (restErr) {
                const restMsg = restErr instanceof Error ? restErr.message : String(restErr);
                console.warn(`  REST API also failed: ${restMsg}`);
                console.warn("  The \"No Primitive Tokens\" check will be skipped.\n");
              }
            }
          } else {
            // rest-api
            try {
              variables = await figmaClient.getFileVariables(fileKey);
              variablesAvailable = true;
              console.log(`  Found ${Object.keys(variables).length} variables`);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              if (msg.includes("403")) {
                console.warn(
                  "  Could not fetch variables: your Figma token lacks the `file_variables:read` scope.",
                );
                console.warn("  To fix this, either:");
                console.warn(
                  "    1. Update your Figma token to include `file_variables:read`, or",
                );
                console.warn(
                  "    2. Re-run with --variable-source mcp to use an MCP server, or",
                );
                console.warn(
                  "    3. Re-run with --variable-source skip to disable variable checks.",
                );
              } else {
                console.warn(`  Could not fetch variables: ${msg}`);
                console.warn(
                  "  Try --variable-source mcp to use an MCP server instead.",
                );
              }
              console.warn(
                "  The \"No Primitive Tokens\" check will be skipped.\n",
              );
            }
          }

          console.log("\nFetching component nodes (with bound variable data)...");
          const componentNodes = new Map<string, FigmaNode>();
          const componentPageMap = new Map<string, string>();

          for (const page of selectedPages) {
            const components = await figmaClient.getComponentNodesWithData(
              fileKey,
              page.id,
            );
            for (const comp of components) {
              componentNodes.set(comp.name, comp);
              componentPageMap.set(comp.name, page.name);
            }
          }

          console.log(`\nAuditing ${componentNodes.size} components...`);

          const savedDecisions = loadClassifications(fileKey);
          const componentNames = Array.from(componentNodes.keys());
          const checksWithRules = registry.getAll().filter((c) => c.componentRules);

          const classificationOverrides: Record<string, ClassificationOverride> = {};
          if (config.checks) {
            for (const [checkId, checkConfig] of Object.entries(config.checks)) {
              if (checkConfig.rules) {
                classificationOverrides[checkId] = checkConfig.rules;
              }
            }
          }

          const ambiguous = collectAmbiguousComponents(
            componentNames,
            checksWithRules,
            savedDecisions,
            classificationOverrides,
          );

          const classifications: Record<string, Record<string, ComponentClassification>> = {};

          if (ambiguous.length > 0) {
            const groupedByCheck = new Map<string, string[]>();
            for (const item of ambiguous) {
              const existing = groupedByCheck.get(item.checkId) ?? [];
              if (!existing.includes(item.componentName)) {
                existing.push(item.componentName);
              }
              groupedByCheck.set(item.checkId, existing);
            }

            console.log("\nSome components need classification for state checks:");

            const newDecisions: Record<string, ComponentClassification> = { ...savedDecisions };

            for (const [checkId, components] of groupedByCheck) {
              const check = registry.getById(checkId);
              if (!check) continue;

              console.log(`\n${check.name}:`);
              for (const compName of components) {
                const decisionKey = `${compName}:${checkId}`;

                const response = await prompts({
                  type: "select",
                  name: "classification",
                  message: `How should "${compName}" be classified?`,
                  choices: [
                    { title: "Interactive (run state check)", value: "interactive" },
                    { title: "Non-interactive (skip state check)", value: "non-interactive" },
                  ],
                  initial: 0,
                });

                if (response.classification) {
                  newDecisions[decisionKey] = response.classification;

                  if (!classifications[compName]) {
                    classifications[compName] = {};
                  }
                  classifications[compName][checkId] = response.classification;
                }
              }
            }

            saveClassifications(fileKey, newDecisions);
            console.log("\nClassifications saved for this Figma file.");
          }

          const checkOverrides: Record<string, { enabled?: boolean; weight?: number }> = {};
          if (!variablesAvailable) {
            checkOverrides["no-primitive-tokens"] = { enabled: false };
          }

          const result = await auditFile({
            fileKey,
            fileName: fileMeta.name,
            pageNames: selectedPageNames,
            componentNodes,
            componentPageMap,
            styles,
            variables,
            checkOverrides,
            classifications,
          });

          const outputDir = options.output;

          const existingAudit = loadAuditResult(outputDir);
          let mergedAudit: AuditResult;

          if (existingAudit && existingAudit.meta.figmaFileKey === fileKey) {
            const skippedChecks = registry.getAll().filter((check) => {
              const override = checkOverrides?.[check.id];
              return override?.enabled === false;
            });

            const newSummaries = result.components.map((c) =>
              buildComponentSummary(
                c.componentName,
                c.score,
                Object.values(c.checkResults).filter((r) => r.status === "pass").length,
                Object.keys(c.checkResults).length,
                c.pageName,
              ),
            );

            mergedAudit = mergeAuditResults({
              existing: existingAudit,
              newResult: result.audit,
              newComponentSummaries: newSummaries,
              newPageNames: selectedPageNames,
              skippedCheckNames: skippedChecks.map((c) => c.name),
            });
          } else {
            mergedAudit = result.audit;
          }

          writeAuditResult(outputDir, mergedAudit);

          for (const compResult of result.components) {
            writeComponentResult(outputDir, compResult);
          }

          console.log(`\n✅ Audit complete!`);
          console.log(`   Total score: ${result.audit.totalScore}/100`);
          console.log(
            `   Components audited: ${result.audit.components.length}`,
          );
          if (!variablesAvailable) {
            console.log(
              `   Skipped: "No Primitive Tokens" check (no variable access)`,
            );
          }
          console.log(`   Output written to: ${outputDir}`);
        },
    );

  return cmd;
}