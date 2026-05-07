import { Command } from "commander";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function reportCommand(): Command {
  const cmd = new Command("report");

  cmd
    .description("Start the web dashboard to view audit results")
    .option("-p, --port <port>", "Port to serve on", "3001")
    .option("-o, --output <dir>", "Output directory to read from", "./output")
    .action((options: { port: string; output: string }) => {
      const webDir = path.resolve(__dirname, "../../../web");
      const outputDir = path.resolve(options.output);

      console.log(`Starting dashboard...`);
      console.log(`Reading results from: ${outputDir}`);

      try {
        execSync(`npx next dev -p ${options.port}`, {
          cwd: webDir,
          env: {
            ...process.env,
            AUDIT_OUTPUT_DIR: outputDir,
          },
          stdio: "inherit",
        });
      } catch {
        // next dev exits on interrupt
      }
    });

  return cmd;
}