# Subtask 5 — SaaS hardening

**Goal:** safe to put in front of strangers. Most items here are small
individually; do them as a sweep before any public announcement.

## Abuse and cost control

- **Quotas:** N audits/day per user (audits are the expensive operation —
  large Figma fetches + compute). Concurrency 1 per user (already in
  subtask 3). Make limits config-driven so a future paid tier can raise them.
- **Rate limiting** on all API routes (e.g. Upstash Ratelimit or Vercel
  firewall rules) — especially `POST /api/audits` and the variable-upload
  endpoint, which accepts unauthenticated-ish plugin traffic gated only by
  pairing codes (make codes single-use, short-lived, and rate-limit attempts).
- **Payload caps:** Figma file response size limit, variable upload size
  limit, page-count cap per audit.
- Email sign-up friction: Supabase captcha integration if bot signups appear.

## Security checklist

- RLS review on every table (write a small test that tries cross-user access
  with the anon key).
- Token encryption verified (subtask 2); secrets only in Vercel/Supabase env.
- Pairing-code uploads: validate file-key match, code expiry, single use.
- No Figma tokens, file payloads, or report contents in logs.
- Dependency audit + `npm audit` in CI.

## Privacy and legal basics

- Privacy policy + terms of service pages (the OAuth app registration with
  Figma will ask for these URLs).
- "Delete my account" — cascades: connections (with token revocation), audits,
  components, classifications, uploads.
- Data inventory is small and should stay that way: tokens, file metadata,
  audit results. The full Figma file payload is processed in-memory and not
  persisted (resumable-chunk state excepted — give it a TTL).

## Observability

- Error tracking (Sentry) on web + runner.
- A simple admin view or SQL snippets: audits/day, failure rate, p95 duration,
  stuck-audit sweep results.
- Alert on elevated audit failure rate (usually means Figma API changes or
  rate-limit trouble).

## Billing (explicitly deferred)

Not in v1. The quota system above is the hook: free tier = current limits,
paid tier = higher limits, Stripe later. Nothing else should need to change.

## Testing

Most of this subtask *is* tests — the deliverable is largely an automated
adversarial suite that runs in CI from here on, so regressions in later
features get caught.

Automated (the permanent suite):

- **Cross-user matrix:** for every table and every API route, attempt
  read/write as (a) anonymous, (b) a different signed-in user. Express this
  as a table-driven test so adding a new table/route to the matrix is one
  line. This is the test that must run forever.
- Quotas: user at the daily audit limit gets a clear 429-style error on the
  next create; limit resets correctly; concurrency cap rejects a second
  simultaneous run.
- Rate limits: burst N+1 requests at `POST /api/audits` and the
  variable-upload endpoint; assert the limiter kicks in. Pairing-code
  brute force: repeated wrong codes from one IP get blocked well before the
  code space is searchable.
- Payload caps: oversized variable upload and over-the-page-cap audit are
  rejected with friendly errors, not 500s.
- Deletion cascade: seed a user with one of everything (connection, audits,
  components, classifications, uploads), delete the account, assert zero
  rows remain in any table for that user id.
- Log hygiene: a smoke test that runs an audit with a known sentinel token
  value and greps captured logs for it (and for raw report content) —
  fails if found.

Manual verification:

- Trigger a real Sentry event from web and from the runner; confirm both
  arrive tagged with environment and audit id.
- Walk the "delete my account" flow in the UI, then verify in the dashboard
  DB that nothing remains and the OAuth token was revoked.
- Review Vercel/Supabase log output for one full real audit: no tokens, no
  file payloads, no report contents.

## Acceptance

- Cross-user access attempts fail (automated test).
- A burst of audit requests from one user gets queued/limited, not run.
- Account deletion leaves no rows behind.
- An on-call-you can answer "why did this audit fail?" from logs/Sentry alone.

## Estimated scope
Medium, spread out. Quotas + RLS tests + deletion are the must-haves before
opening sign-ups; observability can trail by a week.
