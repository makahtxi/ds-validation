# Subtask 4 — Reports and audit history

**Goal:** the existing dashboard, but DB-backed and per-account: every audit is
saved, browsable later without re-running, with score history per file.

Depends on subtask 3 (audits in the DB).

## Port the existing dashboard

`packages/web` already renders the report (DashboardClient, ScoreGauge,
ComponentTable, MatrixSection, ChecksRow, component detail pages). The data
layer is the only thing that changes:

- Replace `src/lib/loadAuditData.ts` (reads `output/*.json` from disk) with
  queries against `audits` + `audit_components`. Since the row jsonb mirrors
  today's JSON shapes (subtask 1 moved the types to `@ds-validation/core`),
  the components should port with minimal changes.
- New routes (all auth-gated, scoped to the signed-in user):
  - `/audits/:id` — the report (today's `/`)
  - `/audits/:id/components/:name` — component detail (today's
    `/components/[name]`)

## Dashboard and history

- `/` (signed in) — list of the user's audited files, latest score per file,
  "New audit" entry point.
- `/files/:fileKey` — audit history for one file: table of runs (date, pages
  audited, score, status) + a score-over-time chart. This is the
  "track performance" feature: same checks over time = comparable scores.
- Nice-to-have (later): diff view between two audits of the same file — which
  components improved/regressed, new/resolved violations.

## Sharing (decide during build)

A report URL is only visible to its owner by default. Two cheap options to
add later if wanted:
- "Share with link" — unguessable token URL, read-only.
- Team workspaces — significantly more work (memberships, roles); explicitly
  out of scope for v1.

## Retention

- Keep all audits by default; add per-audit delete and "delete all my data"
  (ties into subtask 5).
- Watch jsonb sizes: if per-component results get large for big systems,
  move component payloads to Supabase Storage and keep summary columns in
  Postgres. Don't build this until a real file proves the need.

## Testing

The high-value check here is **parity with the existing dashboard**: same
audit data, same rendered report.

Automated:

- Data layer: seed local Supabase with a fixture audit (the standard recorded
  fixture from subtasks 1/3), and assert the new query layer returns data
  deep-equal to what `loadAuditData.ts` returns for the same fixture on disk.
  If these two match, the ported components need no further data-shape tests.
- Component rendering: if the project has no component test setup, don't
  introduce one just for this — the data-parity test above plus manual visual
  comparison is enough. If snapshot tests are cheap to add, snapshot
  ScoreGauge/ComponentTable/MatrixSection with fixture props.
- RLS / access: user B requesting user A's `/audits/:id` (and the component
  detail route) gets 404/403, both via direct DB query with anon key and via
  the route handler.
- History: seed 3 audits for one file key, assert `/files/:fileKey` data
  layer returns them ordered with correct scores; seed audits for two
  different files, assert no cross-contamination.
- Old reports are static: load a `done` audit's report with the Figma client
  mocked to throw — page renders fully (proves zero Figma calls on view).

Manual verification:

- Side-by-side: run the old local dashboard (`output/` files) and the new
  DB-backed report on the same audit data; compare visually page by page,
  including a component detail page with violations.
- Share-link (if built): open in an incognito window — read-only report
  loads, no other routes accessible.

## Acceptance

- A finished audit renders the same report the local dashboard shows today.
- Re-opening an old report makes zero Figma API calls.
- A file audited 3 times shows a 3-point score trend.
- User A cannot load user B's audit by guessing IDs (RLS verified by test).

## Estimated scope
Medium. Mostly porting existing UI; the new surface is the history views.
