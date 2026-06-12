# Subtask 1 — Engine refactor for server use

**Goal:** the audit engine runs in a server context with no filesystem access,
no `process.cwd()` assumptions, and no interactive prompts. The CLI keeps
working as a thin shell over the same code.

**Good news:** `auditFile()` in `packages/agent/src/orchestrator.ts` is already
pure — it takes nodes/styles/variables/classifications in and returns results.
The coupling to fix is all at the edges.

## Changes

### 1. Classification store becomes pluggable
`packages/agent/src/classification-store.ts` reads/writes
`.ds-validation/<fileKey>-classifications.json` via `fs` + `process.cwd()`.

- Define a `ClassificationStore` interface (`load(fileKey)`, `save(fileKey,
  decisions)`) in `@ds-validation/agent`.
- Keep the current fs implementation as `FileClassificationStore` (used by
  CLI); the web backend provides a Postgres-backed implementation.

### 2. Audit output becomes a return value
Today the CLI writes `output/audit.json` + `output/components/*.json`, and the
web app reads them via `packages/web/src/lib/loadAuditData.ts`.

- The orchestrator already returns `AuditFileResult` — make sure everything the
  report needs (including per-component detail currently in
  `components/*.json`) is present on that return value, serializable, and typed
  in `@ds-validation/core`.
- Move the "write to output/" logic into the CLI's report command only.
- The shapes in `loadAuditData.ts` (`AuditData`, `ComponentData`) should move
  to `@ds-validation/core` so DB rows, JSON files, and UI all share one type.

### 3. Figma client: per-call auth, no env coupling
Check `packages/figma/src/client.ts` for any reliance on
`FIGMA_ACCESS_TOKEN` from the environment; the client must accept a token (and
token type — OAuth bearer vs PAT header) per instance, since each web request
acts on behalf of a different user.

- Add basic 429 handling with retry-after backoff here — both CLI and web
  benefit.

### 4. Extract the CLI's audit pipeline into a reusable runner
`packages/cli/src/commands/audit.ts` currently interleaves: URL parsing, file
fetch, page inventory, **prompts**, variable fetching (rest-api / plugin /
skip), orchestrator call, output writing.

- Extract the non-interactive parts into exported functions (likely in
  `@ds-validation/agent` or a new small `@ds-validation/runner` module):
  - `resolveFile(token, url) → { fileKey, fileName, pages[] }` (cheap; used by
    the web's page-selection step)
  - `runAudit({ token, fileKey, pageNames, variables, classifications,
    config, onProgress }) → AuditFileResult`
- `onProgress(stage, current, total)` callback: CLI prints it, web writes it to
  the `audits` row.
- The CLI becomes: prompt → call shared functions → write files.

### 5. Config without `ds-validation.config.ts`
Web users won't have a config file. Define defaults in `@ds-validation/core`
(check weights/overrides largely exist already) and have the runner take a
plain config object. The CLI keeps loading the file via jiti and passing it in.

## Testing

All automated tests use the existing vitest setup (`npm run test` from the
root, plus `npm run typecheck` and `npm run lint`). Add new tests next to the
code they cover, matching the current `*.test.ts` convention.

**Before refactoring — capture a baseline.** Run the CLI against a fixture
(either a real test file or a recorded Figma API payload) and save the
generated `output/audit.json` + `output/components/*.json`. After the
refactor, the same input must produce byte-identical output (modulo
timestamps). This is the single most valuable check for this subtask.

Unit tests to write:

- `ClassificationStore`: the file implementation passes a shared interface
  test suite (load missing file → `{}`, save/load round-trip, corrupt JSON
  → `{}`). Write the suite so the Postgres implementation in subtask 3 can
  reuse it.
- `resolveFile()`: with a mocked Figma client — returns file name + page list;
  propagates 403/404 as typed errors (the web UI will need to distinguish
  "no access" from "not found").
- `runAudit()`: with fixture nodes/styles/variables — returns a complete
  `AuditFileResult`; `onProgress` fires in order (stages monotonic, counts
  reach totals); never touches `fs` (assert via mock or run with `cwd` set to
  a read-only temp dir).
- Serialization: `JSON.parse(JSON.stringify(result))` deep-equals the original
  `AuditFileResult` — guards against Maps/undefined sneaking into the type,
  since this exact shape goes into Postgres jsonb.
- Figma client: token passed per-instance (no `process.env` read — grep test
  or unit test), 429 with `Retry-After` retries then succeeds.

Manual verification:

- `npm run audit -- <real figma url>` end-to-end with each variable source
  (`rest-api`, `plugin`, `skip`) still works, including the interactive
  prompts.
- `cd packages/web && npm run dev` still renders the report from `output/`.

## Acceptance

- `npm run audit` (CLI) behaves exactly as before (baseline diff is clean).
- A Node script with no filesystem writes can run a full audit end-to-end given
  a token, file key, page names, and variables, and receives progress events.
- Existing tests pass; new tests cover the extracted runner functions.

## Estimated scope
Small-medium. Mostly moving code across package boundaries; the orchestrator
and checks are untouched.
