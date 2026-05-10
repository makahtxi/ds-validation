# Component Classification

## Overview

Component classification is a system that determines which conformance checks should run on which components. Not all checks apply to all components — for example, the `state-variables` check (which verifies that components have hover, focus, disabled, etc. states) doesn't make sense for non-interactive components like icons, text labels, or dividers.

The classification system ensures that checks only run on components where they're relevant, preventing false negatives and providing more accurate audit scores.

## How It Works

### Classification Categories

Each component is classified into one of three categories **per check**:

| Category | Behavior |
|---|---|
| **Interactive** | The check runs normally. The component is expected to meet the check's requirements. |
| **Non-interactive** | The check is skipped. The result is marked as "N/A" and excluded from the component's score calculation. |
| **Ambiguous** | The component doesn't clearly match any default rule. The user is prompted to classify it. |

### Default Rules

Checks can declare default classification rules via the `componentRules` property. The `state-variables` check ships with these defaults:

**Interactive** (state check runs):
`button`, `input`, `select`, `checkbox`, `toggle`, `link`, `tab`, `dropdown`, `slider`, `switch`, `radio`, `search`, `textarea`, `combobox`, `autocomplete`, `stepper`, `pagination`

**Non-interactive** (state check skipped):
`icon`, `text`, `label`, `divider`, `avatar`, `badge`, `logo`, `heading`, `paragraph`, `caption`, `spacer`, `separator`, `image`, `illustration`

**Ambiguous** (user prompted):
`card`, `modal`, `dialog`, `tooltip`, `popover`, `menu`, `alert`, `banner`, `chip`, `tag`, `accordion`, `list`, `table`, `navigation`, `sidebar`, `breadcrumb`

### Matching Strategy

Component names are split into tokens (by camelCase, hyphens, underscores, and spaces) and matched using **case-insensitive exact token matching**. For example:
- `"Primary Button"` → `["primary", "button"]` matches `"button"` → interactive
- `"Heading Large"` → `["heading", "large"]` matches `"heading"` → non-interactive
- `"Dialog-Modal"` → `["dialog", "modal"]` matches `"dialog"` → ambiguous (prompts user)
- `"Buttons"` → `["buttons"]` does NOT match pattern `"button"` (exact token, not substring)

If a component doesn't match any rule in any category, it defaults to **ambiguous**.

## Classification Flow

```
Component fetched
       │
       ▼
Check has componentRules? ──No──► Run check on all components
       │
      Yes
       │
       ▼
Match against rules (overrides → interactive → non-interactive → ambiguous)
       │
       ├── Interactive ──► Run check
       │
       ├── Non-interactive ──► Skip check (N/A, excluded from score)
       │
       └── Ambiguous ──► Prompt user
                          │
                          ▼
                   Save decision to .ds-validation/<fileKey>-classifications.json
                          │
                          ▼
                   Run check based on user's choice
```

## Per-File Persistence

Classification decisions are saved per Figma file in `.ds-validation/<fileKey>-classifications.json`:

```json
{
  "fileKey": "abc123def456",
  "decisions": {
    "Dialog:state-variables": "non-interactive",
    "Card:state-variables": "interactive",
    "Menu:state-variables": "non-interactive"
  },
  "updatedAt": "2026-05-09T12:00:00.000Z"
}
```

The decision key format is `<componentName>:<checkId>`. This allows different classifications for the same component across different checks.

On subsequent audits of the same file:
1. Saved decisions are loaded automatically
2. Only **new** ambiguous components (not yet classified) trigger prompts
3. Previously classified components use their saved classification

## Scoring Impact

When a check is marked as **non-interactive** (N/A):
- The check result has `notApplicable: true`
- It is **excluded** from the component's weighted score calculation
- It does not count as a pass or fail
- The component's score is computed only from checks that actually ran

Example: If a component has 5 checks but 1 is N/A, the score is computed from the remaining 4 checks using their normalized weights.

## Configuration

### Extending Default Rules

You can override or extend the default classification rules in `ds-validation.config.ts`:

```typescript
export default defineConfig({
  checks: {
    "state-variables": {
      weight: 0.15,
      rules: {
        interactive: ["custom-button", "my-input"],
        nonInteractive: ["static-card", "read-only-text"],
      },
    },
  },
});
```

Config overrides take precedence over default rules.

### Adding Classification to New Checks

To add component classification to a new check, add the `componentRules` property:

```typescript
export const myNewCheck: ConformanceCheck = {
  id: "my-new-check",
  name: "My New Check",
  weight: 0.20,
  componentRules: {
    interactive: ["button", "input"],
    nonInteractive: ["icon", "text"],
  },
  async run(context: CheckContext): Promise<CheckResult> {
    // ...
  },
};
```

Components that don't match any interactive or non-interactive pattern default to **ambiguous** and will prompt the user.

Checks without `componentRules` run on all components (existing behavior).

## Architecture

### Key Files

| File | Purpose |
|---|---|
| `packages/core/src/types/classification.ts` | Type definitions |
| `packages/core/src/types/checks.ts` | Extended `ConformanceCheck` with `componentRules` |
| `packages/core/src/scoring/score.ts` | Filters out N/A results in score calculation |
| `packages/agent/src/classifier.ts` | Classification logic (matching, collecting ambiguous) |
| `packages/agent/src/classification-store.ts` | Persistence layer (load/save) |
| `packages/agent/src/orchestrator.ts` | Classification-aware check execution |
| `packages/cli/src/commands/audit.ts` | Batch classification prompt |

### Design Decisions

1. **Exact token matching over substring matching**: Component names are tokenized by splitting on camelCase, hyphens, underscores, and spaces. Patterns are matched against individual tokens. This prevents false positives like `"TextField"` being misclassified as non-interactive because it contains `"text"`. A pattern like `"button"` will match `"Primary Button"` but not `"Buttons"`.

2. **Per-check classification**: The same component can be interactive for one check and non-interactive for another. This allows fine-grained control as new checks are added.

3. **Ambiguous defaults to prompt**: Components that don't match any rule are classified as ambiguous rather than being silently skipped or always checked. This ensures the user makes an intentional decision.

4. **Per-file persistence**: Decisions are scoped to a specific Figma file because different design systems may classify the same component differently (e.g., one system's "Card" may be interactive, another's may not).

5. **N/A excluded from score**: Non-applicable checks don't penalize or boost the component score. This is more accurate than counting them as passes.

6. **Batch prompting**: All ambiguous components are collected upfront and presented to the user in a single session, similar to page selection. This is more efficient than prompting during the audit loop.
