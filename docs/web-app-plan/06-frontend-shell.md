# Subtask 6 — Frontend app shell

**Goal:** the SaaS application around the feature screens: landing page, auth
screens, navigation, layout, and the shared UI patterns every other subtask's
screens plug into.

**Ownership note:** feature screens belong to their feature subtasks (settings
→ 02, audit wizard → 03, reports/history → 04). This subtask owns everything
cross-cutting. It has no dependency on the engine refactor and can start
immediately, in parallel with subtask 1 — it only needs subtask 2's Supabase
project to exist for real sign-in wiring (build against stubs until then).

## Current state

`packages/web` is a local report viewer: two routes (`/`,
`/components/[name]`), no auth, no nav, reads JSON from disk. Next.js 15 +
React 19 + Tailwind 4. **Decision: keep building here** — the report
components (ScoreGauge, ComponentTable, etc.) carry over, and one app keeps
deployment simple.

## Route structure

```
/                     signed-out: landing page · signed-in: dashboard
/login                magic link + Google (Supabase Auth UI or custom)
/auth/callback        Supabase auth callback
/audits/new           audit setup wizard        (screens: subtask 3)
/audits/:id           progress → report         (screens: subtasks 3, 4)
/audits/:id/components/:name                    (subtask 4)
/files/:fileKey       per-file history          (subtask 4)
/settings/connections Figma connect / PAT       (subtask 2)
/privacy, /terms      static                    (subtask 5)
```

- Route groups: `(marketing)` for the public pages, `(app)` for everything
  auth-gated, each with its own layout.
- Auth gating via Next.js middleware + Supabase SSR helpers: unauthenticated
  hits on `(app)` routes redirect to `/login` with a return-to param.

## App chrome

- `(app)` layout: top nav (logo, "New audit" button, settings, account menu
  with sign-out), content container. Keep it minimal — this product is one
  primary object (the audit) plus settings; no sidebar needed at v1.
- `(marketing)` layout: bare header (logo, sign in) + footer (privacy/terms).

## Landing page

The product pitch for a signed-out designer: what it checks (the 5
conformance checks), a screenshot of a real report, one CTA ("Audit your
design system"). Honest scope: one well-made page, not a marketing site.
Reuse the report's visual language so the screenshot and the product match.

## Shared UI patterns (the real value of this subtask)

Establish once, so subtasks 2–4 don't each invent their own:

- **Async states:** skeleton/loading, empty (no audits yet → "Connect Figma"
  or "Run your first audit" nudges), and error with retry. The audit flow is
  full of waiting — these must feel deliberate.
- **Feedback:** one toast pattern for success/failure of mutations.
- **Forms:** field + validation-error styling (PAT entry, audit setup).
- **Design tokens:** extend the existing Tailwind setup into a small set of
  semantic colors/spacing used by both marketing and app. The audience is
  designers — visual quality is part of the product's credibility.
- A `components/ui/` home for these primitives, documented with a sentence
  each in the package README.

## Out of scope

- Feature screens (owned by subtasks 2–4).
- Team/workspace UI, billing UI (deferred with their backends).
- Dark mode unless it falls out of the token setup for free.

## Testing

Automated:

- Middleware: unauthenticated request to each `(app)` route redirects to
  `/login` (table-driven over the route list); authenticated request passes;
  return-to param round-trips after login.
- Auth callback: happy path establishes a session; error param renders the
  login page with a message, not a crash.
- Smoke: `next build` succeeds and every route in the structure above
  renders without throwing given stub data (catch broken imports early —
  cheap and surprisingly effective).

Manual verification:

- Full journey on a deployed preview: land signed-out → read landing page →
  sign in with magic link → empty dashboard with nudge → sign out.
- Mobile-width pass over landing, login, and dashboard (designers will open
  this on a laptop, but the landing page will get shared on phones).
- Quick accessibility pass: keyboard-only through nav + login, focus visible,
  Lighthouse a11y score as a baseline number to not regress.

## Acceptance

- All routes exist with correct gating; signed-out users see exactly the
  marketing pages and login.
- A new user can sign up, land on an empty dashboard, and be pointed at
  "Connect Figma" (even if that page is still a stub).
- Loading/empty/error/toast patterns exist and are used by at least one real
  screen.
- `next build` + route smoke tests green in CI.

## Estimated scope
Medium. The shell itself is routine; the shared patterns and the landing page
are where the time goes — and where polish pays off for this audience.
