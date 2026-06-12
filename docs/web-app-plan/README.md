# DS Validation Web App — Migration Plan

Turn the terminal-based audit tool into a hosted web app: a designer pastes a
Figma link, walks through the same interactive choices the CLI offers today
(pages, variable source), and gets a shareable report saved to their account
with full audit history.

## Decisions already made

| Decision | Choice |
| --- | --- |
| Figma access | OAuth ("Connect Figma") as primary, encrypted PAT as fallback |
| Audience | Public SaaS — anyone can sign up |
| Platform | Supabase (auth, Postgres, storage) + Vercel (existing Next.js app) |
| Audit flow | Keep the interactive steps: page selection + variable-source choice |

## Target architecture

```
Browser (Next.js app on Vercel)
  │  paste Figma URL
  ▼
API routes (Next.js route handlers, service-role Supabase client)
  │  1. resolve file meta + pages  (fast, synchronous)
  │  2. user picks pages + variable source
  │  3. enqueue audit run
  ▼
Audit runner (Vercel background function, resumable/chunked)
  │  fetch file via @ds-validation/figma (user's OAuth token / PAT)
  │  run checks via @ds-validation/agent (already pure — no FS)
  │  write progress + results to Postgres
  ▼
Supabase Postgres ──► report pages, audit history, score-over-time
```

The audit engine (`core`, `figma`, `agent`) stays shared between CLI and web —
the CLI keeps working, both are thin shells around the same packages.

## Subtask plans

1. [01-engine-refactor.md](01-engine-refactor.md) — decouple the engine from
   the local filesystem and interactive prompts so it runs server-side.
2. [02-accounts-and-figma-auth.md](02-accounts-and-figma-auth.md) — Supabase
   auth, Figma OAuth connect flow, encrypted PAT fallback, token refresh.
3. [03-audit-service.md](03-audit-service.md) — the audit run lifecycle:
   interactive setup steps, background execution, the variables problem
   (plugin handoff to the hosted backend), progress reporting.
4. [04-reports-and-history.md](04-reports-and-history.md) — port the existing
   dashboard to DB-backed data, audit history, score trends.
5. [05-saas-hardening.md](05-saas-hardening.md) — rate limits, quotas, abuse
   prevention, data deletion, legal basics.
6. [06-frontend-shell.md](06-frontend-shell.md) — the app around the feature
   screens: landing page, auth screens, navigation/layout, shared UI patterns
   (loading/empty/error states, forms, toasts).

**Frontend ownership:** each feature subtask owns its own screens (settings →
2, audit wizard → 3, reports/history → 4); subtask 6 owns the cross-cutting
shell those screens plug into.

Suggested order: 1 and 6 can start immediately in parallel (6 needs no engine
work); 2 follows 1 or runs alongside; 3 depends on 1 + 2 (+ 6's shell for its
screens); 4 depends on 3; 5 sweeps last before opening sign-ups.

## Data model (summary)

```
figma_connections   user_id, kind ('oauth'|'pat'), encrypted access/refresh
                    tokens, figma_user_id, expires_at
audits              id, user_id, file_key, file_name, status
                    ('draft'|'queued'|'running'|'done'|'error'), progress,
                    selected_pages, variable_source, total_score, config jsonb,
                    created_at
audit_components    audit_id, component_name, page_name, score, result jsonb
                    (mirrors today's components/*.json)
variable_uploads    pairing_code, user_id, file_key, payload jsonb, expires_at
classifications     user_id, file_key, decisions jsonb
                    (replaces .ds-validation/<fileKey>-classifications.json)
```

All tables behind RLS; tokens never readable from the client — only the
service-role server code touches `figma_connections`.

## Testing strategy (shared infrastructure)

Each subtask doc has a `## Testing` section (how to verify) feeding its
`## Acceptance` checklist (definition of done). Shared pieces, built once in
subtask 1 and reused throughout:

- **Recorded Figma fixture:** one real design-system file's API responses
  (file payload, styles, variables) captured to JSON and checked into test
  fixtures. All audit-engine and service tests run against it — deterministic,
  no network, no token needed in CI.
- **Baseline report:** the CLI's `output/` for that fixture, captured before
  any refactoring. Engine changes are validated by diffing against it; the
  web report is validated by data-parity against the same fixture.
- **Local Supabase** (`supabase start`) for integration tests: RLS, audit
  lifecycle, pairing codes, deletion cascades. The cross-user access matrix
  (subtask 5) runs in CI permanently.
- Existing tooling stays: vitest (`npm run test`), `npm run typecheck`,
  `npm run lint` must pass at every step.

## Key risks (details in subtask docs)

- **Variables are the hard part, not the token.** Figma's variables REST
  endpoint (`file_variables:read`) is Enterprise-plan only. For everyone else
  the existing Figma plugin is the only path — it must be reworked to POST to
  the hosted backend (pairing-code flow) instead of `localhost:7070`.
- **Long-running audits vs serverless limits.** Large files take minutes to
  fetch and scan. The runner must be chunked/resumable from day one so it fits
  function time limits and can later move to a real queue if needed.
- **Large Figma file payloads.** `/v1/files/:key` responses can be tens of MB;
  memory and Figma rate limits (429s) need explicit handling.
