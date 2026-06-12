# Subtask 3 — Audit execution service

**Goal:** the web equivalent of `npm run audit -- <url>`: paste a link, pick
pages and a variable source (the CLI's interactive steps, as UI), then a
background run with live progress.

Depends on subtasks 1 (runner functions) and 2 (tokens).

## Run lifecycle

```
draft ──► (user picks pages + variable source) ──► queued ──► running ──► done
                                                                  └─► error
```

1. **Create draft** — user pastes a Figma URL. `POST /api/audits` parses the
   URL, calls `resolveFile()` (fast: file name + page list, e.g. `?depth=1`),
   stores a `draft` audit row. Errors surface immediately: bad URL, no access
   to file, token invalid.
2. **Setup step (interactive)** — UI shows the page list with checkboxes
   (mirroring the CLI prompt) and the variable-source choice:
   - **REST API** — only offered if the connection has the variables scope
     (Enterprise); try it and fall back gracefully on 403.
   - **Figma plugin** — pairing flow below.
   - **Skip** — primitive-token check disabled, clearly labeled with the
     score impact.
3. **Run** — `POST /api/audits/:id/start` sets `queued` and invokes the
   background runner.
4. **Progress** — runner writes `progress` (stage + counts from `onProgress`)
   to the audit row; the UI polls or subscribes via Supabase Realtime.
5. **Done** — results written to `audits` (totals) + `audit_components`
   (per-component jsonb); UI redirects to the report.

## The variables problem (plugin handoff)

Variables REST access is Enterprise-only, so the Figma plugin remains the main
path for most users. Today it POSTs to `localhost:7070`; for the web app:

- Add the app's domain to the plugin manifest's
  `networkAccess.allowedDomains`.
- **Pairing flow:** the audit setup page shows a short-lived pairing code
  (e.g. 6 characters, 10-minute expiry, stored in `variable_uploads`). The
  designer opens the DS Validation plugin in their Figma file, enters the
  code, and the plugin POSTs the local variables payload to
  `POST /api/variable-uploads` with the code. The web page (polling/Realtime)
  detects the upload and continues automatically.
- Validate server-side that the uploaded payload's file key matches the
  audit's file key, and cap payload size.
- Publish the plugin to the Figma Community so users don't need a manual
  install (interim: "import from manifest" instructions).
- UX copy matters here — this is the clunkiest step in the product. Show a
  short illustrated "open the plugin → enter code" panel.

## Background execution on Vercel

- Start with a single background function (`maxDuration` raised on Pro) that
  runs the whole audit and streams progress to the DB.
- **Design the runner as resumable chunks anyway:** persist intermediate state
  keyed by audit id (file fetched → pages inventoried → components checked
  N of M). If big files blow past function limits, the function re-invokes
  itself to continue, or the runner moves to a queue (Trigger.dev / Inngest /
  Supabase queues) without rearchitecting.
- Guard rails: per-user concurrency of 1 running audit; overall file-size
  limit (abort with a friendly error if the Figma payload exceeds a threshold);
  timeout marks the audit `error` with a retry button, never stuck `running`
  (sweep stale `running` rows older than N minutes).
- Figma 429s: respect `Retry-After`, surface "Figma is rate-limiting us,
  retrying…" in progress.

## Classifications

The CLI caches component classifications in `.ds-validation/`. Web version:
the Postgres-backed `ClassificationStore` from subtask 1, keyed by
`(user_id, file_key)` so re-audits of the same file reuse decisions.

## Testing

Use a recorded Figma file payload as the standard fixture (same one as
subtask 1's baseline) so audit runs are deterministic and never hit the real
API in CI. Integration tests run against local Supabase.

Unit tests:

- Lifecycle state machine: only legal transitions allowed
  (`draft→queued→running→done/error`); `start` on a non-draft audit is
  rejected; a second concurrent `start` for the same user is rejected
  (concurrency = 1).
- Pairing codes: expired code rejected; reused code rejected (single-use);
  payload file key ≠ audit file key rejected; payload over the size cap
  rejected; happy path marks the upload consumed and attaches variables to
  the audit.
- Runner chunking: given a fixture with N components and a chunk size of k,
  intermediate state is persisted after each chunk; resuming from persisted
  state at chunk i produces the identical final report as an uninterrupted
  run (assert deep-equal).
- 429 handling: mocked Figma client returns 429 + `Retry-After` then
  succeeds; runner retries and progress reflects the wait.
- Stale-run sweep: a `running` audit older than the threshold is flipped to
  `error`; a fresh one is untouched.

Integration tests:

- Full run end-to-end against local Supabase with the mocked Figma client:
  create draft → select pages → start → poll until `done` → `audits` row has
  totals, `audit_components` rows match the fixture's component count.
- Kill-and-resume: abort the runner mid-run (after chunk 1), invoke the
  resume path, audit completes with correct results.
- Variable upload endpoint: POST with valid code from an unauthenticated
  context (the plugin has no session) succeeds; same POST with a bogus code
  is rejected and rate-limited after repeated attempts.
- Classification reuse: audit the same fixture file twice; second run loads
  the stored decisions (assert the store's `load` was hit and no
  re-classification occurred).

Manual verification (deployed preview):

- The whole designer journey with a real Figma file: paste URL → pick pages →
  pairing code → open plugin in Figma → enter code → web page auto-advances →
  progress updates live → report renders.
- Variable source fallbacks: REST attempt on a non-Enterprise token degrades
  gracefully to the plugin/skip choice; "skip" disables the primitive-token
  check and labels it in the report.
- Cancel/timeout: kill the background function mid-run (redeploy works);
  audit shows `error` with a working retry button, never stuck `running`.

## Acceptance

- Paste URL → pick pages → pick variable source → watch progress → report.
- Plugin pairing works end-to-end against the deployed backend.
- A second audit of the same file reuses classifications.
- Kill the function mid-run: audit ends in `error` with retry, not stuck.

## Estimated scope
Large — this is the core subtask. The plugin pairing flow and the
resumable runner are the two pieces that need real design attention.
