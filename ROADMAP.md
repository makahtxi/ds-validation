# DS Validation — Implementation Roadmap

## Phase 1: Foundation (packages: `core`, `figma`)

### 1.1 Monorepo Scaffolding
- [x] Initialize root `package.json` with npm workspaces pointing to `packages/*`
- [x] Add `turbo.json` with pipeline configs (build, dev, lint, typecheck)
- [x] Add root `tsconfig.json` with project references for each package
- [x] Add `.gitignore`, `.node-version`
- [x] Add `eslint` config (flat config, TypeScript support)
- [x] Add `prettier` config
- [x] Create all 5 packages with `package.json` + `tsconfig.json` each

### 1.2 Core Package — Types
- [x] Define `FigmaNode` type (mirrors relevant Figma REST API node fields)
- [x] Define `FigmaStyle` type (color, text, effect, grid styles)
- [x] Define `FigmaVariable` type (id, name, variableCollectionId, resolvedType, valuesByMode)
- [x] Define `ConformanceCheck` interface (`id`, `name`, `weight`, `run`)
- [x] Define `CheckContext` interface (`componentNode`, `styles`, `variables`, `ai`)
- [x] Define `CheckResult` interface (`checkId`, `score`, `status`, `violations`, `summary`)
- [x] Define `Violation` interface (`nodePath`, `property`, `rawValue`, `expected`, `suggestedReplacement?`)
- [x] Define `SummaryEntry` interface (`template`, `params`)
- [x] Define `ConformanceCheckConfig` interface (`id`, `name`, `weight`)
- [x] Define `AuditResult` interface (meta, totalScore, summary, components list)
- [x] Define `ComponentSummary` interface (name, score, jsonPath, passedChecks, totalChecks)
- [x] Define `ComponentAuditResult` interface (componentName, score, checkResults)
- [x] Define `AIClient` interface (`classifyToken`, `classifyTokens`, `generateSummary`)
- [x] Define config schema type (`DSValidationConfig`)

### 1.3 Core Package — Scoring Logic
- [x] Implement `computeCheckScore(violations, totalChecks)` — returns 0–100
- [x] Implement `computeComponentScore(checkResults, weights)` — weighted average
- [x] Implement `computeTotalScore(componentScores)` — simple average
- [x] Implement `determineStatus(score)` — pass (≥80), partial (50–79), fail (<50)
- [x] Add unit tests for all scoring functions

### 1.4 Core Package — Summary Templates
- [x] Define the set of template IDs and their parameter schemas (11 templates)
- [x] Implement `buildSummary(templateId, params)` helper
- [x] Implement `renderSummary(entry)` for web app
- [x] Add unit tests for template rendering

### 1.5 Core Package — JSON Output Schema
- [x] Define Zod schemas for `AuditResult` and `ComponentAuditResult`
- [x] Implement `writeAuditResult(outputDir, result)` — writes `audit.json`
- [x] Implement `writeComponentResult(outputDir, result)` — writes `components/<name>.json`
- [x] Add unit tests for writer

### 1.6 Figma Package — API Client
- [x] Define `FigmaClient` class with `accessToken` config
- [x] Implement `getFileMeta(fileKey)` — fetches file metadata
- [x] Implement `getFilePages(fileKey)` — fetches pages with component counts
- [x] Implement `getFileStyles(fileKey)` — fetches all style definitions
- [x] Implement `getFileVariables(fileKey)` — fetches all variable definitions
- [x] Implement `getFileNodes(fileKey, nodeIds)` — fetches specific node trees
- [x] Implement `getComponentNodes(fileKey, pageId)` — fetches all components on a page
- [x] Handle Figma API rate limiting (429 responses, retry-after header)
- [x] Add response type mapping (raw API response → our types)
- [x] Add basic unit test

---

## Phase 2: Agent & Checks (packages: `agent`, `cli`)

### 2.1 Agent Package — Check Registry
- [x] Implement `CheckRegistry` class with `register(check)`, `getAll()`, `getById(id)`
- [x] Create `checks/registry.ts` with auto-registration
- [x] Create `register-checks.ts` that registers all 5 checks

### 2.2 Agent Package — AI Client (Vercel AI SDK)
- [x] Install `ai` and `@ai-sdk/openai`
- [x] Implement `createAIClient()` factory function
- [x] Implement `classifyToken()` — single token classification
- [x] Implement `classifyTokens()` — batch classification
- [x] Implement `generatePrimitiveTokenSummary()` — builds SummaryEntry from violations
- [x] Configure model selection (default: gpt-4o, configurable)
- [x] Add structured output parsing (Zod schemas for AI responses)
- [x] Error handling with fallback for AI call failures

### 2.3 Agent Package — Check: Hardcoded Colors
- [x] Create `checks/hardcoded-colors.ts`
- [x] Implement node traversal: walk all nodes recursively
- [x] For each node, inspect `fills` and `strokes` arrays
- [x] Check for `styleId` or `boundVariables` on each paint
- [x] If no binding found → create violation with hex color value
- [x] Build `SummaryEntry`: `hardcoded_colors_found` or `hardcoded_colors_clean`
- [x] Compute score: `(1 - violations.length / totalPaints) * 100`
- [x] Add unit tests

### 2.4 Agent Package — Check: Hardcoded Spacing
- [x] Create `checks/hardcoded-spacing.ts`
- [x] Implement node traversal: walk all nodes
- [x] Check padding and spacing properties for `boundVariables`
- [x] Check absolute positioning (`x`, `y`) for non-auto-layout children
- [x] Build `SummaryEntry`: `hardcoded_spacing_found` or `hardcoded_spacing_clean`
- [x] Compute score: `(1 - violations.length / totalSpacingProps) * 100`
- [x] Add unit tests

### 2.5 Agent Package — Check: Hardcoded Text Styles
- [x] Create `checks/hardcoded-text-styles.ts`
- [x] Filter for text nodes (`type === "TEXT"`)
- [x] Check for `styleId` or `boundVariables` on font properties
- [x] Special cases: `lineHeight: AUTO` and `letterSpacing: 0` → acceptable
- [x] Build `SummaryEntry`: `hardcoded_text_styles_found` or `hardcoded_text_styles_clean`
- [x] Compute score: `(1 - violations.length / totalTextProps) * 100`
- [x] Add unit tests

### 2.6 Agent Package — Check: No Primitive Tokens
- [x] Create `checks/no-primitive-tokens.ts`
- [x] Traverse node tree, collect all `boundVariables` and `styleId` references
- [x] Resolve references to token names using styles/variables maps
- [x] Batch token classifications via `ai.classifyTokens()`
- [x] Handle `primitive` and `wrong_category` classifications as violations
- [x] Build `SummaryEntry` using AI-generated summary
- [x] Compute score: `(1 - violations.length / totalTokenRefs) * 100`
- [x] Add unit tests with mocked AI responses

### 2.7 Agent Package — Check: State Variables
- [x] Create `checks/state-variables.ts`
- [x] Read `componentPropertyDefinitions` from root component node
- [x] Look for state values: Default, Hover, Selected, Disabled, Focused
- [x] Check both variant property names and values
- [x] Compute score: `(statesFound / 5) * 100`
- [x] Add unit tests

### 2.8 Agent Package — Orchestrator
- [x] Create `orchestrator.ts` with `auditComponent()` function
- [x] Build `CheckContext` from component node, styles, variables, AI client
- [x] Iterate through all registered checks, run each with context
- [x] Collect `CheckResult`s into `ComponentAuditResult`
- [x] Compute weighted score using check weights
- [x] Create `auditFile()` top-level function returning `AuditFileResult`
- [x] Error handling: failed checks report as score 0 with error violation

### 2.9 CLI Package — Interactive Flow
- [x] Set up `package.json` bin entry for `ds-validation`
- [x] Add `commander` for CLI argument parsing
- [x] Implement `ds-validation audit <figma-url>` command with interactive page selection
- [x] Implement `ds-validation report` command (starts Next.js dev server)
- [x] Implement `ds-validation init` command (generates config template)
- [x] Config file support via `ds-validation.config.ts`
- [x] Add `--pages`, `--output`, `--api-key`, `--ai-key` CLI flags

### 2.10 Integration Tests
- [x] Unit tests for all 4 deterministic checks (hardcoded-colors, hardcoded-spacing, hardcoded-text-styles, state-variables)
- [x] Unit tests for scoring functions (core)
- [x] Unit tests for summary templates (core)
- [x] Unit tests for JSON writer (core)
- [x] Unit tests for CLI utility (parseFileKey)
- [ ] End-to-end integration test (needs Figma API key)

### 2.11 MCP Integration for Variable Fetching
- [x] Create `packages/mcp` with `McpVariableClient` class
- [x] Connect to `figma-console-mcp` via stdio transport
- [x] Parse MCP responses (3 formats: array, `{ variables: [] }`, `{ meta: { variables: {} } }`)
- [x] Pass `FIGMA_ACCESS_TOKEN` env var to MCP server process
- [x] CLI audit command: `--variable-source`, `--mcp-command`, `--mcp-args` flags
- [x] Interactive prompt for variable source selection (REST API / MCP / skip)
- [x] MCP fallback to REST API on failure
- [x] `checkOverrides` to disable `no-primitive-tokens` when variables unavailable
- [x] Placeholder test for MCP client instantiation
- [ ] Full MCP integration tests (mock stdio transport)

---

## Phase 3: Web Dashboard (package: `web`)

### 3.1 Next.js App Scaffolding
- [x] Initialize Next.js app with App Router and Tailwind CSS v4
- [x] Set up project structure with `src/app/`, `src/components/`, `src/lib/`

### 3.2 Data Loading
- [x] Implement `loadAuditData()` — reads `output/audit.json`
- [x] Implement `loadComponentData(name)` — reads `output/components/<name>.json`
- [x] Configurable output directory via `AUDIT_OUTPUT_DIR` env var

### 3.3 Summary Template Renderer
- [x] Import `SUMMARY_TEMPLATES` from `@ds-validation/core`
- [x] Implement `renderSummary()` function in web lib
- [x] Implement `SummaryRenderer` React component

### 3.4 Overview Page
- [x] Header with file name, audit date, total score
- [x] Score gauge component (circular SVG, color-coded)
- [x] Summary section with `SummaryEntry` rendered
- [x] Component grid with score cards linking to detail pages

### 3.5 Component Detail Page
- [x] Header with component name, back link, score
- [x] Score gauge displayed prominently
- [x] Check results list with status badges
- [x] Expandable violation tables (node path, property, raw value, expected, suggestion)

### 3.6 Styling & UX
- [x] Responsive layout
- [x] Error state for missing audit data
- [x] Error state for missing component data
- [ ] Dark mode support (not yet implemented)
- [ ] Loading states for data fetching (not yet needed — SSG)

---

## Phase 4: Polish & DX

### 4.1 Config File Support
- [x] Config schema type defined (`DSValidationConfig`)
- [x] `ds-validation init` command generates config template
- [ ] Runtime config loading and validation (currently CLI-only)

### 4.2 Error Handling
- [x] Figma API rate limiting (429 retry)
- [x] Figma API error messages
- [x] AI API error handling with fallback (treats all tokens as semantic on failure)
- [x] Partial audit support (failed checks report as score 0)
- [x] Clear error messages for missing API key, invalid URL

### 4.3 Non-Interactive Mode
- [x] `--pages` CLI flag for specifying pages without interactive prompt
- [x] `--output` CLI flag
- [ ] `--config` CLI flag for config file path
- [ ] `--no-ai` flag to skip AI-dependent checks
- [ ] `--json` flag to output results to stdout

### 4.4 Developer Experience
- [ ] Add `README.md` at root with setup instructions, usage, and architecture overview
- [x] Example `ds-validation.config.ts` generated by `init` command
- [ ] Add example output JSON files for web app development
- [x] All packages have proper `package.json` scripts (build, test, lint, typecheck)
- [x] Turborepo pipeline configs for parallel builds

### 4.5 Testing
- [x] 40 tests passing across core, figma, agent, cli, mcp packages
- [x] Unit tests for all scoring functions
- [x] Unit tests for 4 conformance checks (hardcoded-colors, hardcoded-spacing, hardcoded-text-styles, state-variables)
- [x] Unit tests for summary templates
- [x] Unit tests for JSON writer
- [x] Unit tests for CLI utility (parseFileKey)
- [ ] Unit tests for Figma API client (with mocked responses)
- [ ] Integration tests for CLI (with mocked API and prompt inputs)
- [ ] Integration tests for web app (page rendering with sample data)