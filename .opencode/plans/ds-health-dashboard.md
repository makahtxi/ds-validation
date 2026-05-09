# DS Health Dashboard — Implementation Plan

## Overview
Redesign the report page (home page) to match the "Conform·DS — Design System Health" dashboard design.

## Files to Modify
1. `packages/web/src/styles/globals.css` — Add CSS custom properties and base styles
2. `packages/web/src/lib/utils.ts` — Add scoring utility functions
3. `packages/web/src/components/ScoreGauge.tsx` — Update to match new gauge design
4. `packages/web/src/app/page.tsx` — Complete rewrite with new layout
5. `packages/web/src/app/components/[name]/page.tsx` — Update detail page styling

## New Files to Create
1. `packages/web/src/components/HeroSection.tsx` — Hero with score, grade, stats, component status
2. `packages/web/src/components/ChecksRow.tsx` — 5-column check breakdown cards
3. `packages/web/src/components/MatrixSection.tsx` — Heatmap matrix grouped by page (client component)
4. `packages/web/src/components/ComponentTable.tsx` — Searchable/filterable/sortable table (client component)

## Implementation Steps
1. Add CSS design tokens (OKLCH colors, fonts, radii) to globals.css
2. Add utility functions (statusForScore, bucketForScore, gradeForScore) to lib/utils.ts
3. Create HeroSection component
4. Create ChecksRow component
5. Create MatrixSection component (client component with tooltips, sorting)
6. Create ComponentTable component (client component with search, filter, sort)
7. Update ScoreGauge component
8. Rewrite page.tsx with full dashboard layout
9. Update component detail page
10. Run lint and typecheck
