# DS Validation — Architecture

## Overview

DS Validation is a tool that audits Figma design system files for token misuse and missing token usage. It reads a Figma file, runs conformance checks on components, and outputs structured JSON that a Next.js dashboard renders as a visual report.

## Monorepo Structure

```
ds-validation/
├── packages/
│   ├── core/                # Shared types, scoring logic, config schema
│   ├── figma/               # Figma REST API client
│   ├── agent/               # AI agent + conformance checks
│   ├── cli/                 # Interactive CLI entry point
│   └── web/                # Next.js dashboard
├── package.json
├── turbo.json
└── tsconfig.json
```

## Data Flow

```
User provides Figma URL
  → CLI parses URL, fetches file via Figma API
  → Agent inventories pages/components
  → CLI prompts user: which pages to scan?
  → Agent runs 5 conformance checks per component
  → Writes JSON output files
  → Web app reads JSON → renders dashboard
```

## Core Types

### Figma Types

```typescript
interface FigmaNode {
  id: string;
  name: string;
  type: string;
  fills?: Paint[];
  strokes?: Paint[];
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  styleId?: string;
  boundVariables?: Record<string, { id: string; type: string }>;
  componentPropertyDefinitions?: Record<string, ComponentPropertyDefinition>;
  children?: FigmaNode[];
  // Text node properties
  style?: TypeStyle;
  characters?: string;
  // Absolute positioning
  x?: number;
  y?: number;
}

interface FigmaStyle {
  id: string;
  name: string;
  styleType: "FILL" | "TEXT" | "EFFECT" | "GRID";
  description?: string;
}

interface FigmaVariable {
  id: string;
  name: string;
  variableCollectionId: string;
  resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  valuesByMode: Record<string, VariableValue>;
}
```

### Check Types

```typescript
interface ConformanceCheck {
  id: string;
  name: string;
  weight: number;
  run(context: CheckContext): Promise<CheckResult>;
}

interface CheckContext {
  componentNode: FigmaNode;
  styles: Record<string, FigmaStyle>;
  variables: Record<string, FigmaVariable>;
  ai: AIClient;
}
```

### Result Types

```typescript
interface CheckResult {
  checkId: string;
  score: number;                         // 0–100
  status: "pass" | "fail" | "partial";
  violations: Violation[];
  summary: SummaryEntry;
}

interface Violation {
  nodePath: string;                       // e.g. "Button > Icon"
  property: string;                       // e.g. "fills[0]"
  rawValue: string;                        // e.g. "#FF0000"
  expected: string;                        // e.g. "A semantic color variable"
  suggestedReplacement?: string;           // e.g. "color-action-primary"
}

interface SummaryEntry {
  template: string;                      // Template ID for webapp rendering
  params: Record<string, string | number>; // Substitution values
}
```

### Output Schema

**`output/audit.json`**

```typescript
interface AuditResult {
  meta: {
    figmaFileKey: string;
    figmaFileName: string;
    auditedAt: string;                // ISO timestamp
    pagesAudited: string[];
    conformanceChecks: ConformanceCheckConfig[];
  };
  totalScore: number;                  // 0–100, avg of component scores
  summary: SummaryEntry;
  components: ComponentSummary[];
}

interface ConformanceCheckConfig {
  id: string;
  name: string;
  weight: number;
}

interface ComponentSummary {
  name: string;
  score: number;
  jsonPath: string;                    // e.g. "components/button.json"
  passedChecks: number;
  totalChecks: number;
}
```

**`output/components/<name>.json`**

```typescript
interface ComponentAuditResult {
  componentName: string;
  score: number;                        // Weighted 0–100
  checkResults: Record<string, CheckResult>;
}
```

### AI Client Interface

```typescript
interface AIClient {
  classifyToken(
    tokenName: string,
    semanticTokenList: string[]
  ): Promise<{
    classification: "semantic" | "primitive" | "wrong_category";
    suggestedReplacement: string | null;
  }>;

  generatePrimitiveTokenSummary(
    violations: Violation[]
  ): Promise<SummaryEntry>;
}
```

## Scoring Model

| Test | Weight |
|------|--------|
| No hard-coded colors | 25% |
| No hard-coded text-styles | 20% |
| No primitive tokens | 25% |
| No hard-coded spacing | 15% |
| State variables available | 15% |

### Score Calculation

- **Check score**: `(1 - violations / total_opportunities) * 100`
  - Where `total_opportunities` is the total number of properties inspected for that check
  - Special case for state variables: `(statesFound / 5) * 100`
- **Component score**: Weighted average of all check scores
- **Total score**: Simple average of all component scores
- **Status**: pass (score ≥ 80), partial (50 ≤ score < 80), fail (score < 50)

## Conformance Checks

### 1. Hardcoded Colors (weight: 0.25)

Mechanism: Pure data inspection, no AI needed.

- Traverse all nodes, inspect `fills` and `strokes` arrays
- For each paint entry, check if `boundVariables` maps to a variable reference OR if `styleId` links to a defined style
- No binding found → violation with `nodePath`, `property: "fills[i]"`, `rawValue: hex`, `expected: "A semantic color variable"`

### 2. Hardcoded Spacing (weight: 0.15)

Mechanism: Pure data inspection, no AI needed.

- Check auto-layout padding: `paddingLeft`, `paddingRight`, `paddingTop`, `paddingBottom`, `itemSpacing`
- Check absolute positioning: `x`, `y` on non-auto-layout children
- For each non-zero spacing value, check `boundVariables` for that property
- No binding found → violation

### 3. Hardcoded Text Styles (weight: 0.20)

Mechanism: Pure data inspection, no AI needed.

- Filter for text nodes (`type === "TEXT"`)
- Check for `styleId` (if present, all sub-properties pass)
- If no `styleId`: check `boundVariables` for `fontFamily`, `fontSize`, `lineHeight`, `letterSpacing`
- `lineHeight: AUTO` and `letterSpacing: 0%` are acceptable, NOT violations
- Each unbound property → one violation

### 4. No Primitive Tokens (weight: 0.25)

Mechanism: AI-assisted classification.

- Gather all `boundVariables` and `styleId` references in the component
- Resolve each reference to its token name using the styles/variables maps
- Pass to AI with the full list of semantic tokens from the file
- AI classifies each as: `semantic`, `primitive`, or `wrong_category`
  - `primitive`: Token is a raw/foundation token (e.g. `color-blue-500`, `spacing-4`)
  - `wrong_category`: Token is semantic but used outside its intended category (e.g. `color-text-primary` used as background)
- Both `primitive` and `wrong_category` are violations
- AI also suggests the correct semantic replacement for each violation
- Token classifications are batched to minimize AI calls

### 5. State Variables (weight: 0.15)

Mechanism: Pure data inspection, no AI needed.

- Inspect `componentPropertyDefinitions` from the root component node
- Look for variant properties containing state values: `Default`, `Hover`, `Selected`, `Disabled`, `Focused`
- Check both property names and property values (states can be organized as variant property names like "State" with values, or as separate boolean properties)
- Missing states → violation listing which state is missing
- Score: `(statesFound / 5) * 100`

## Check Architecture

Each check lives in its own file:

```
packages/agent/src/checks/
├── types.ts
├── registry.ts           # Registers all checks
├── hardcoded-colors.ts
├── hardcoded-spacing.ts
├── hardcoded-text-styles.ts
├── no-primitive-tokens.ts
└── state-variables.ts
```

Adding a new check: Create a new file exporting a `ConformanceCheck`, register it in `registry.ts`.

Removing a check: Delete the file and remove from `registry.ts`.

## Summary Templates

All summaries use a deterministic `template` + `params` format. The webapp owns rendering.

| Template ID | Params | Deterministic? |
|---|---|---|
| `hardcoded_colors_found` | `{ count }` | Yes |
| `hardcoded_colors_clean` | `{}` | Yes |
| `hardcoded_spacing_found` | `{ count }` | Yes |
| `hardcoded_spacing_clean` | `{}` | Yes |
| `hardcoded_text_styles_found` | `{ count }` | Yes |
| `hardcoded_text_styles_clean` | `{}` | Yes |
| `primitive_tokens_found` | `{ count, examples }` | No (AI) |
| `primitive_tokens_clean` | `{}` | Yes |
| `wrong_category_usage_found` | `{ count, example }` | No (AI) |
| `state_variables_partial` | `{ found, total }` | Yes |
| `state_variables_complete` | `{}` | Yes |

## AI Agent Usage

The AI (Vercel AI SDK, provider-agnostic) is used for exactly two things:

1. **Token classification** (in `no-primitive-tokens.ts`): Given a token name and the list of semantic tokens, classify it and suggest a replacement. Returns a structured `{ classification, suggestedReplacement }` response.

2. **Check summary** (only for `no-primitive-tokens`): Since this check can have nuanced results (primitive tokens + wrong-category usage), the AI generates a summary converted into the deterministic `SummaryEntry` format.

All other summaries are built deterministically from violation data.

## CLI Usage

```bash
# Start interactive audit
npx ds-validation audit <figma-url>

# Agent inventories pages, prompts selection, runs checks, writes JSON

# Serve dashboard locally
npx ds-validation report

# Generate config file
npx ds-validation init
```

## Web App (Next.js)

- **`/`** — Overview: total score gauge, component grid with scores, aggregate pass/fail counts per check type
- **`/components/[name]`** — Per-component detail: score gauge, check results with expandable violation lists, suggested replacements
- Renders `SummaryEntry` objects using a template map
- Reads from `output/` directory (SSG or ISR)

## Config Schema

```typescript
interface DSValidationConfig {
  figma?: {
    fileKey?: string;           // Override URL-parsed file key
    accessToken?: string;      // Or use FIGMA_ACCESS_TOKEN env var
  };
  checks?: {
    [checkId: string]: {
      weight?: number;          // Override default weight
      enabled?: boolean;       // Disable a check
    };
  };
  ai?: {
    model?: string;            // e.g. "gpt-4o", default from Vercel AI SDK
    apiKey?: string;           // Or use OPENAI_API_KEY env var
  };
  output?: {
    dir?: string;              // Default: "./output"
  };
}
```