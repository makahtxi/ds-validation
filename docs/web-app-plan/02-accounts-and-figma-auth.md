# Subtask 2 — Accounts and Figma authorization

**Goal:** users sign up, connect Figma via OAuth (or paste a PAT as fallback),
and the backend can fetch their files on their behalf — with tokens stored so
the client can never read them.

## App accounts (Supabase Auth)

- Email magic link + Google sign-in to start. Designers rarely want passwords.
- Optional: Supabase also offers Figma as a *sign-in* provider. Tempting to
  merge "sign in" and "connect Figma" into one step, but Supabase does not
  refresh provider tokens for you, and tying account identity to Figma locks
  users in. **Recommendation:** keep identity (Supabase) and Figma access (our
  own OAuth flow) separate; revisit "Sign in with Figma" as a convenience later.
- Standard Supabase RLS setup: every table keyed by `user_id`, policies deny by
  default.

## Figma OAuth connect flow (primary)

1. Register an OAuth app at figma.com/developers (name, logo, callback URL —
   one for prod, one for local dev).
2. "Connect Figma" button → standard authorization-code flow in a Next.js
   route handler pair (`/api/figma/connect`, `/api/figma/callback`), with a
   `state` value stored server-side to prevent CSRF.
3. Request the minimal read scopes needed by the audit (file content +
   metadata; verify exact scope names against current Figma docs at build
   time). Do **not** request `file_variables:read` by default — it only works
   for Enterprise orgs and inflates the consent screen; consider it as an
   optional "upgrade" connect for Enterprise users (see subtask 3).
4. Store in `figma_connections`: access token, refresh token, expiry,
   `figma_user_id`, granted scopes.
5. Token refresh: a small server-side helper `getFigmaToken(userId)` that
   refreshes transparently when near expiry and updates the row. All backend
   Figma calls go through it.

## PAT fallback

- Settings page field: "Personal access token" with short instructions and a
  deep link to Figma's token page.
- Validate on save by calling `GET /v1/me`; store the Figma user info so the UI
  can show "Connected as <name>".
- PATs don't expire/refresh — simpler path, used when org policy blocks OAuth
  apps or a designer prefers it.

## Token storage security

- Encrypt tokens at rest: either Supabase Vault, or app-level AES-256-GCM with
  the key in Vercel env (key never in the DB). Pick one and use it for both
  OAuth tokens and PATs.
- `figma_connections` has **no** RLS select policy for end users — only the
  service-role key (server code) reads it. The client only ever sees
  connection status metadata via an API route.
- "Disconnect" deletes the row and (for OAuth) calls Figma's token revocation
  if available.

## UI

- `/settings/connections`: connection status, connect/disconnect, PAT entry,
  which Figma account is linked.
- Empty-state nudge on the dashboard: "Connect Figma to run your first audit."

## Testing

OAuth flows resist pure unit testing; split into three layers — unit tests
with mocked fetch, integration tests against local Supabase
(`supabase start`), and a short manual script against the real Figma OAuth
app.

Unit tests:

- Encryption helpers: encrypt/decrypt round-trip; decrypting with a wrong key
  throws (does not return garbage); ciphertext differs between two encryptions
  of the same plaintext (random IV).
- `getFigmaToken(userId)`: token not near expiry → returned as-is, no refresh
  call; near/past expiry → refresh endpoint called once, new tokens persisted,
  new access token returned; refresh failure (revoked) → typed error the UI
  can map to "please reconnect"; concurrent calls don't double-refresh
  (single-flight or row lock — whichever is implemented, test it).
- OAuth callback handler: rejects missing/mismatched `state`; rejects reused
  `state`.
- PAT save: mocked `GET /v1/me` success stores connection with Figma user
  info; 403 surfaces a validation error and stores nothing.

Integration tests (local Supabase, anon + service-role clients):

- RLS: with the anon key and a signed-in test user, `select` on
  `figma_connections` returns zero rows — including the user's own row.
- Tokens at rest: read the row with the service-role key and assert the
  stored value is not the plaintext token.
- Disconnect deletes the row.

Manual verification (once per environment, against the registered Figma app):

- Full connect flow in local dev: button → Figma consent → callback →
  settings shows "Connected as <name>".
- Backend can `GET /v1/me` and fetch a real file with the stored token.
- Force-expire the access token (edit `expires_at` in the DB) and run any
  Figma-touching action: refresh happens transparently.
- Disconnect, confirm the token no longer works if revocation is supported.
- Repeat connect with a PAT instead of OAuth.

## Acceptance

- A new user can sign up, connect via OAuth, and the backend can call
  `GET /v1/me` and `GET /v1/files/:key` with their token.
- Same with a PAT instead.
- Tokens are encrypted in the DB and unreadable via the anon/client key.
- An expired OAuth token is refreshed transparently during an audit.

## Estimated scope
Medium. The OAuth dance and token-refresh plumbing are well-trodden but fiddly;
budget time for testing the refresh path.
