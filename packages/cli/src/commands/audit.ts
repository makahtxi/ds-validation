import { Command } from "commander";
import prompts from "prompts";
import { FigmaClient } from "@ds-validation/figma";
import { auditFile, registry } from "@ds-validation/agent";
import { McpVariableClient, PluginVariableClient } from "@ds-validation/mcp";
import {
  writeAuditResult,
  loadAuditResult,
  writeComponentResult,
  mergeAuditResults,
  buildComponentSummary,
  type FigmaNode,
  type FigmaVariable,
  type FigmaFileMeta,
  type FigmaPageSummary,
  type FigmaStyle,
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
    .option("--variable-source <source>", "How to fetch variables: rest-api, plugin, or skip (mcp is deprecated)", "rest-api")
    .option("--mcp-command <command>", "MCP server command (default: npx -y figma-console-mcp@latest)", "npx")
    .option("--mcp-args <args>", "MCP server args (comma-separated)", "-y,figma-console-mcp@latest,--stdio")
    .option("--plugin-port <port>", "Local port for the DS Validation Figma plugin to POST variables to", "7070")
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
          pluginPort: string;
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

          const variableSource = options.variableSource as "rest-api" | "plugin" | "mcp" | "skip";

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
                { title: "Figma plugin (open the DS Validation plugin in your Figma file)", value: "plugin" },
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
          const resolvedFileKey: string = fileKey;

          // Single API call returns meta, pages, and styles together.
          // Cast needed because getFileData was added in this worktree and the workspace
          // symlink still points to the pre-change figma package types.
          const figmaClientFull = figmaClient as unknown as {
            getFileData(key: string): Promise<{
              meta: FigmaFileMeta;
              pages: FigmaPageSummary[];
              styles: Record<string, FigmaStyle>;
            }>;
          };

          console.log(`Fetching Figma file: ${fileKey}...`);
          const { meta: fileMeta, pages: allPages, styles } = await figmaClientFull.getFileData(resolvedFileKey);
          console.log(`File: ${fileMeta.name}`);
          console.log(`  Found ${Object.keys(styles).length} styles`);

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

          async function fetchVariables(): Promise<{ variables: Record<string, FigmaVariable>; variablesAvailable: boolean }> {
            if (finalVariableSource === "skip") {
              console.log("\nSkipping variables (user choice).");
              console.log("  Note: The \"No Primitive Tokens\" check will be skipped.");
              return { variables: {}, variablesAvailable: false };
            }

            console.log("\nFetching variables...");

            if (finalVariableSource === "plugin") {
              const pluginPort = parseInt(options.pluginPort, 10);
              const pluginClient = new PluginVariableClient({ port: pluginPort });
              try {
                const vars = await pluginClient.getVariables();
                console.log(`  Found ${Object.keys(vars).length} variables (via Figma plugin)`);
                return { variables: vars, variablesAvailable: Object.keys(vars).length > 0 };
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.warn(`  Figma plugin variable fetch failed: ${msg}`);
                console.warn("  The \"No Primitive Tokens\" check will be skipped.\n");
                return { variables: {}, variablesAvailable: false };
              }
            }

            if (finalVariableSource === "mcp") {
              console.warn("  Warning: --variable-source mcp is deprecated. Use --variable-source plugin instead.");
              console.log("  Fetching variables via MCP server...");
              const mcpArgs = options.mcpArgs.split(",").map((a: string) => a.trim());
              const mcpClient = new McpVariableClient({
                command: options.mcpCommand,
                args: mcpArgs,
                figmaApiKey: figmaToken,
              });
              try {
                const vars = await mcpClient.getVariables(figmaUrl);
                console.log(`  Found ${Object.keys(vars).length} variables (via MCP)`);
                return { variables: vars, variablesAvailable: Object.keys(vars).length > 0 };
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.warn(`  MCP variable fetch failed: ${msg}`);
                console.warn("  Falling back to REST API...");
                try {
                  const vars = await figmaClient.getFileVariables(resolvedFileKey);
                  console.log(`  Found ${Object.keys(vars).length} variables (via REST API)`);
                  return { variables: vars, variablesAvailable: Object.keys(vars).length > 0 };
                } catch (restErr) {
                  const restMsg = restErr instanceof Error ? restErr.message : String(restErr);
                  console.warn(`  REST API also failed: ${restMsg}`);
                  console.warn("  The \"No Primitive Tokens\" check will be skipped.\n");
                  return { variables: {}, variablesAvailable: false };
                }
              }
            }

            // rest-api
            try {
              const vars = await figmaClient.getFileVariables(resolvedFileKey);
              console.log(`  Found ${Object.keys(vars).length} variables`);
              return { variables: vars, variablesAvailable: true };
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
                  "    2. Re-run with --variable-source plugin to use the Figma plugin, or",
                );
                console.warn(
                  "    3. Re-run with --variable-source skip to disable variable checks.",
                );
              } else {
                console.warn(`  Could not fetch variables: ${msg}`);
                console.warn(
                  "  Try --variable-source plugin to use the Figma plugin instead.",
                );
              }
              console.warn(
                "  The \"No Primitive Tokens\" check will be skipped.\n",
              );
              return { variables: {}, variablesAvailable: false };
            }
          }

          console.log("\nFetching component nodes (with bound variable data)...");
          const t0 = Date.now();

          const [{ variables, variablesAvailable }, pageComponentResults] = await Promise.all([
            fetchVariables(),
            Promise.all(
              selectedPages.map(async (page) => {
                const t = Date.now();
                const components = await figmaClient.getComponentNodesWithData(resolvedFileKey, page.id);
                console.log(`  Page "${page.name}": ${components.length} components fetched in ${((Date.now() - t) / 1000).toFixed(1)}s`);
                return { page, components };
              }),
            ),
          ]);
          console.log(`  Total fetch: ${((Date.now() - t0) / 1000).toFixed(1)}s`);

          const componentNodes = new Map<string, FigmaNode>();
          const componentPageMap = new Map<string, string>();
          for (const { page, components } of pageComponentResults) {
            for (const comp of components) {
              componentNodes.set(comp.name, comp);
              componentPageMap.set(comp.name, page.name);
            }
          }

          console.log(`\nAuditing ${componentNodes.size} components...`);
          const tAudit = Date.now();

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

          const { ambiguous, autoClassified } = collectAmbiguousComponents(
            componentNames,
            checksWithRules,
            savedDecisions,
            classificationOverrides,
          );

          const classifications: Record<string, Record<string, ComponentClassification>> = {};

          for (const [key, value] of Object.entries(savedDecisions)) {
            const separatorIndex = key.indexOf(":");
            if (separatorIndex === -1) continue;
            const componentName = key.slice(0, separatorIndex);
            const checkId = key.slice(separatorIndex + 1);
            if (!classifications[componentName]) {
              classifications[componentName] = {};
            }
            classifications[componentName][checkId] = value;
          }

          for (const [key, classification] of Object.entries(autoClassified)) {
            const separatorIndex = key.indexOf(":");
            if (separatorIndex === -1) continue;
            const componentName = key.slice(0, separatorIndex);
            const checkId = key.slice(separatorIndex + 1);
            if (!classifications[componentName]) {
              classifications[componentName] = {};
            }
            classifications[componentName][checkId] = classification;
          }

          if (ambiguous.length > 0) {
            const groupedByCheck = new Map<string, string[]>();
            for (const item of ambiguous) {
              const existing = groupedByCheck.get(item.checkId) ?? [];
              if (!existing.includes(item.componentName)) {
                existing.push(item.componentName);
              }
              groupedByCheck.set(item.checkId, existing);
            }

            console.log("\nSome components need classification before checks can run:");

            const newDecisions: Record<string, ComponentClassification> = { ...savedDecisions };

            let userDismissed = false;

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
                } else {
                  console.warn("\nClassification prompt dismissed. Remaining components will be re-prompted on next run.");
                  userDismissed = true;
                  break;
                }
              }

              if (userDismissed) break;
            }

            saveClassifications(fileKey, newDecisions);
            if (!userDismissed) {
              console.log("\nClassifications saved for this Figma file.");
            }
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
          console.log(`  Check processing: ${((Date.now() - tAudit) / 1000).toFixed(1)}s`);

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