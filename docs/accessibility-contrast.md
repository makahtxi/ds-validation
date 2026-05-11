# Accessibility Contrast Check

## Overview

The `accessibility-contrast` check validates that text-to-background contrast ratios meet WCAG AA thresholds. It walks the component tree, composites background colors through the ancestor chain, and compares each text node's fill against the effective background.

## WCAG AA Thresholds

| Text type | Minimum ratio |
|---|---|
| Normal text | 4.5:1 |
| Large text (18px+, or 14px+ bold) | 3.0:1 |

"Bold" is defined as font weight 600 or higher.

## How It Works

### Background Compositing

The check determines the effective background color behind each text node by walking the tree top-down:

1. Starts with a white background (`#ffffff`)
2. At each non-text node, composites all visible solid fills (bottom-to-top) into the accumulated background
3. Accounts for per-fill opacity, color alpha, and node-level opacity
4. Passes the composited background down to children

### Variable Resolution

When a fill is bound to a Figma variable, the check resolves the variable chain (following aliases) to get the actual color value. This ensures that token-aliased colors are evaluated by their resolved value, not their reference.

When both the text fill and background fill are variable-bound, the violation's `suggestedReplacement` reports the variable names (e.g., `text/primary vs surface/default (ratio: 3.2:1)`).

### Disabled Variants

Variants with `State=Disabled` in their name are skipped entirely. Disabled components intentionally use reduced contrast to communicate their inactive state, so flagging them would produce false positives. The match is case-insensitive and uses word boundaries (e.g., `"Mode=Light, State=Disabled, Raised=No"` is skipped).

## Violation Output

Each violation includes:

| Field | Content |
|---|---|
| `nodePath` | Full path through the component tree (e.g., `Button > Label`) |
| `property` | `fills[0]` |
| `rawValue` | Actual ratio and colors (e.g., `3.2:1 (text: #666666, bg: #ffffff)`) |
| `expected` | Required ratio and standard (e.g., `>=4.5:1 (WCAG AA)`) |
| `suggestedReplacement` | Variable names if both fills are token-bound |

## Configuration

In `ds-validation.config.ts`:

```typescript
checks: {
  "accessibility-contrast": { weight: 0.2, enabled: true },
}
```

Default weight is `0.20`.

## Scoring

The score is calculated as:

```
score = round((1 - violations / totalTextNodes) * 100)
```

If a component has no text nodes, it scores 100 (no opportunities to violate).

## Key Files

| File | Purpose |
|---|---|
| `packages/agent/src/checks/accessibility-contrast.ts` | Check implementation |
| `packages/core/src/color/contrast.ts` | WCAG utilities (linearize, luminance, contrast ratio, blend, colorToHex) |
| `packages/core/src/templates/templates.ts` | Summary templates (`contrast_found`, `contrast_clean`) |

## Limitations

- Only evaluates solid fills. Gradient and image fills are ignored.
- Uses the first mode's value when resolving variables with multiple modes.
- Assumes a white page background when no ancestor has a fill.
- Does not account for effects like shadows or overlays that may alter perceived contrast.
