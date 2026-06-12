// Captures Figma API responses and produces a baseline audit output.
// Saves raw fixture data + the resulting audit to test/fixtures/.
import { writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { FigmaClient } from "../packages/figma/dist/client.js";
import { auditFile, registry } from "../packages/agent/dist/index.js";
import { loadClassifications } from "../packages/agent/dist/classification-store.js";
import { collectAmbiguousComponents } from "../packages/agent/dist/classifier.js";

const FILE_KEY = "amizYpLxwZCeoPRVZEtLIk";

// Small representative pages — pick ones with manageable component counts
const PAGE_NAMES = [
  "Logos",
  "Tooltip",
  "Loaders",
  "Dividers",
  "Pagination",
  "Breadcrumb",
  "Scrolls",
  "Cursors",
  "Datepicker",
  "Timepicker",
];

async function main() {
  const token = process.env.FIGMA_ACCESS_TOKEN;
  if (!token) throw new Error("FIGMA_ACCESS_TOKEN not set");

  const client = new FigmaClient(token);

  // 1. Fetch file meta + pages (depth=1)
  const { meta, pages: allPages } = await client.getFileData(FILE_KEY);
  console.log(`File: ${meta.name} (${allPages.length} pages)`);

  const selectedPages = allPages.filter((p) => PAGE_NAMES.includes(p.name));
  if (selectedPages.length !== PAGE_NAMES.length) {
    const found = new Set(selectedPages.map((p) => p.name));
    const missing = PAGE_NAMES.filter((n) => !found.has(n));
    console.warn("Missing pages:", missing);
  }

  // 2. Fetch page-level node data for each selected page
  const pageData = new Map();
  for (const page of selectedPages) {
    console.log(`Fetching nodes for page "${page.name}"...`);
    const components = await client.getComponentNodesWithData(FILE_KEY, page.id);
    console.log(`  → ${components.length} components`);
    pageData.set(page.name, components);
  }

  // 3. Fetch variables
  console.log("Fetching variables...");
  let variables = {};
  let variablesAvailable = false;
  try {
    variables = await client.getFileVariables(FILE_KEY);
    variablesAvailable = Object.keys(variables).length > 0;
    console.log(`  → ${Object.keys(variables).length} variables`);
  } catch (err) {
    console.warn(`  Variables fetch failed: ${err.message}`);
  }

  // 4. Build the data structures expected by auditFile()
  const componentNodes = new Map();
  const componentPageMap = new Map();
  for (const [pageName, components] of pageData) {
    for (const comp of components) {
      componentNodes.set(comp.name, comp);
      componentPageMap.set(comp.name, pageName);
    }
  }

  // 5. Run classification (use saved decisions where available)
  const savedDecisions = loadClassifications(FILE_KEY);
  const componentNames = Array.from(componentNodes.keys());
  const checksWithRules = registry.getAll().filter((c) => c.componentRules);

  const { ambiguous, autoClassified } = collectAmbiguousComponents(
    componentNames,
    checksWithRules,
    savedDecisions,
    {},
  );

  const classifications = {};
  for (const [key, value] of Object.entries(savedDecisions)) {
    const sep = key.indexOf(":");
    if (sep === -1) continue;
    const compName = key.slice(0, sep);
    const checkId = key.slice(sep + 1);
    if (!classifications[compName]) classifications[compName] = {};
    classifications[compName][checkId] = value;
  }
  for (const [key, classification] of Object.entries(autoClassified)) {
    const sep = key.indexOf(":");
    if (sep === -1) continue;
    const compName = key.slice(0, sep);
    const checkId = key.slice(sep + 1);
    if (!classifications[compName]) classifications[compName] = {};
    classifications[compName][checkId] = classification;
  }

  // For any remaining ambiguous, classify as non-interactive (so we can run non-interactively)
  for (const item of ambiguous) {
    if (!classifications[item.componentName]) classifications[item.componentName] = {};
    classifications[item.componentName][item.checkId] = "non-interactive";
  }
  if (ambiguous.length > 0) {
    console.log(`Note: ${ambiguous.length} ambiguous components auto-classified as non-interactive`);
  }

  // 6. Run audit
  const checkOverrides = {};
  if (!variablesAvailable) {
    checkOverrides["no-primitive-tokens"] = { enabled: false };
  }

  console.log(`Auditing ${componentNodes.size} components...`);
  const result = await auditFile({
    fileKey: FILE_KEY,
    fileName: meta.name,
    pageNames: selectedPages.map((p) => p.name),
    componentNodes,
    componentPageMap,
    styles: {},
    variables,
    checkOverrides,
    classifications,
  });

  // 7. Save fixtures and baseline
  mkdirSync("test/fixtures/figma", { recursive: true });

  // Save the page data as fixture (serializable Figma node trees)
  const pageDataObj = {};
  for (const [name, components] of pageData) {
    pageDataObj[name] = components;
  }
  writeFileSync(
    "test/fixtures/figma/page-data.json",
    JSON.stringify(pageDataObj, null, 2),
  );

  // Save variables as fixture
  writeFileSync(
    "test/fixtures/figma/variables.json",
    JSON.stringify(variables, null, 2),
  );

  // Save file metadata
  writeFileSync(
    "test/fixtures/figma/file-meta.json",
    JSON.stringify({ key: meta.key, name: meta.name, lastModified: meta.lastModified }, null, 2),
  );

  // Save the full AuditFileResult as baseline
  writeFileSync(
    "test/fixtures/baseline-audit.json",
    JSON.stringify(result, null, 2),
  );

  // Also write to output/ so the web app can still read it
  mkdirSync("output", { recursive: true });
  mkdirSync("output/components", { recursive: true });

  writeFileSync("output/audit.json", JSON.stringify(result.audit, null, 2));
  for (const comp of result.components) {
    const safeName = comp.componentName.replace(/[^a-zA-Z0-9_-]/g, "_");
    writeFileSync(`output/components/${safeName}.json`, JSON.stringify(comp, null, 2));
  }

  console.log(`\nBaseline captured:`);
  console.log(`  Fixtures: test/fixtures/figma/`);
  console.log(`  Baseline: test/fixtures/baseline-audit.json`);
  console.log(`  Output:   output/`);
  console.log(`  Total score: ${result.audit.totalScore}`);
  console.log(`  Components: ${result.audit.components.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
