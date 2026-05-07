# DS Validation — AI Agent Guide

## Project Overview

DS Validation is a tool that audits Figma design system files for token misuse and missing token usage. It's a TypeScript monorepo with 6 packages.

## Monorepo Structure

```
ds-validation/
├── packages/
│   ├── core/       # Shared types, scoring logic, config schema
│   ├── figma/      # Figma REST API client
│   ├── agent/      # AI agent + conformance checks
│   ├── cli/        # Interactive CLI entry point
│   ├── mcp/        # MCP integration for variable fetching
│   └── web/        # Next.js dashboard
├── output/         # Audit results (audit.json, components/*.json)
├── ds-validation.config.ts
├── turbo.json
└── tsconfig.json
```

## Development Commands

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run development mode
npm run dev

# Run linting
npm run lint

# Run type checking
npm run typecheck

# Run tests
npm run test

# Format code
npm run format
```

## Package-Specific Commands

```bash
# CLI - run interactive audit
cd packages/cli && npm run dev audit <figma-url>

# CLI - generate config
cd packages/cli && npm run dev init

# Web - start dashboard
cd packages/web && npm run dev
```

## Running Inside AI Coding Agents

### Claude Code

```bash
# Set environment variables first
export FIGMA_ACCESS_TOKEN=your-token

# Then ask Claude Code to run the audit
claude "run npm run dev audit <your-figma-url> from packages/cli directory"
```

### GitHub Copilot Workspace

```bash
# In Copilot chat, request:
"Run the DS Validation CLI audit command with this Figma URL: <your-figma-url>"

# Or execute directly in terminal:
cd packages/cli && npm run dev audit <your-figma-url>
```

### OpenCode

```bash
# Ask OpenCode to execute:
"Execute: cd packages/cli && npm run dev audit <your-figma-url>"
```

> **Note:** You need `FIGMA_ACCESS_TOKEN` environment variable set - this is required to fetch Figma file data. All 5 checks run without AI API keys!

## Key Architecture Concepts

### Data Flow
1. CLI parses Figma URL, fetches file via Figma API or MCP
2. Agent inventories pages/components
3. User selects pages to scan
4. Agent runs 5 conformance checks per component
5. Writes JSON output to `output/` directory
6. Next.js web app reads JSON and renders dashboard

### Conformance Checks (5 total)
1. **hardcoded-colors** (25%): Checks for unbound fills/strokes
2. **hardcoded-spacing** (15%): Checks for unbound padding/spacing
3. **hardcoded-text-styles** (20%): Checks for unbound text style properties
4. **no-primitive-tokens** (25%): Rule-based check for primitive token usage
5. **state-variables** (15%): Checks for component state variants

### No AI Required!

All 5 conformance checks now run **without AI API keys**:

- **no-primitive-tokens** check analyzes variable definitions directly:
  - Variables with `VARIABLE_ALIAS` values → ✅ semantic (good)
  - Variables with hardcoded values (colors, numbers) → ❌ primitive (violation)
  - Suggests semantic alternatives by finding variables that alias the primitive

This means you can run full audits with **only** a Figma access token - no OpenAI/Anthropic costs!

### Scoring Model
- Check score: `(1 - violations / total_opportunities) * 100`
- Component score: Weighted average of check scores
- Total score: Simple average of component scores
- Status: pass (≥80), partial (50-79), fail (<50)

## Important Files

- `packages/core/src/types.ts` - All TypeScript types
- `packages/core/src/scoring.ts` - Score calculation logic
- `packages/core/src/summary-templates.ts` - Summary template definitions
- `packages/agent/src/checks/registry.ts` - Check registration
- `packages/agent/src/checks/*.ts` - Individual check implementations
- `packages/figma/src/client.ts` - Figma API client
- `packages/mcp/src/client.ts` - MCP variable client
- `ds-validation.config.ts` - Project configuration

## Environment Variables

Create a `.env` file in the project root:

```bash
FIGMA_ACCESS_TOKEN=your-figma-token
```

Or set via shell:

```bash
export FIGMA_ACCESS_TOKEN=<your-figma-token>
```

## Coding Conventions

- TypeScript strict mode enabled
- No comments unless explaining complex logic
- Follow existing code style in each package
- Use existing utilities and types from `@ds-validation/core`
- Error handling: fail gracefully, report errors in check results

## Adding New Features

### New Conformance Check
1. Create `packages/agent/src/checks/<check-name>.ts`
2. Export `ConformanceCheck` interface
3. Register in `packages/agent/src/checks/registry.ts`
4. Update weights in `ds-validation.config.ts`

### New Package
1. Create `packages/<name>/` with `package.json` and `tsconfig.json`
2. Add to root `package.json` workspaces array
3. Add build pipeline to `turbo.json`

## Testing

- Unit tests live alongside source files (`*.test.ts`)
- Run tests: `npm run test`
- Mock AI responses for deterministic tests
- Mock Figma API responses for client tests

## Output Schema

Results are written to `output/audit.json` and `output/components/<name>.json`. See `ARCHITECTURE.md` for full schema details.
