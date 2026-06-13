-- Subtask 3 — audit execution service tables.
--
-- audits / audit_components are USER-READABLE via RLS (so the report UI can read
-- the signed-in user's own runs directly), but all writes go through service-role
-- server code only. variable_uploads / classifications are service-role-only
-- (deny-all): the Figma plugin uploads variables with no session, through a
-- service-role route keyed by a pairing code — never from the client.

-- ---------------------------------------------------------------------------
-- audits
-- ---------------------------------------------------------------------------
create table if not exists audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_key text not null,
  file_name text,
  status text not null default 'draft'
    check (status in ('draft', 'queued', 'running', 'done', 'error')),
  -- { stage: string, current: number, total: number }
  progress jsonb not null default '{}'::jsonb,
  selected_pages text[],
  variable_source text check (variable_source in ('rest', 'plugin', 'skip')),
  total_score int,
  -- audit config (check weights/overrides) carried into the run
  config jsonb not null default '{}'::jsonb,
  -- serializable resumable checkpoint + worker lease (see web runner)
  runner_state jsonb,
  error_message text,
  started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_audits_user_id on audits (user_id);
create index if not exists idx_audits_user_status on audits (user_id, status);
create index if not exists idx_audits_file_key on audits (user_id, file_key);

alter table audits enable row level security;

-- Users may read their own audits; all writes are service-role only.
create policy "audits_select_own" on audits
  for select to authenticated using (auth.uid() = user_id);
create policy "audits_deny_insert" on audits
  for insert to anon, authenticated with check (false);
create policy "audits_deny_update" on audits
  for update to anon, authenticated using (false);
create policy "audits_deny_delete" on audits
  for delete to anon, authenticated using (false);

-- ---------------------------------------------------------------------------
-- audit_components (one row per audited component)
-- ---------------------------------------------------------------------------
create table if not exists audit_components (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references audits(id) on delete cascade,
  -- denormalized so RLS can authorize without a join back to audits
  user_id uuid not null references auth.users(id) on delete cascade,
  component_name text not null,
  page_name text,
  score int,
  -- the full ComponentAuditResult (checkResults, violations, …)
  result jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_components_audit_id on audit_components (audit_id);
create unique index if not exists idx_audit_components_unique
  on audit_components (audit_id, component_name);

alter table audit_components enable row level security;

create policy "audit_components_select_own" on audit_components
  for select to authenticated using (auth.uid() = user_id);
create policy "audit_components_deny_insert" on audit_components
  for insert to anon, authenticated with check (false);
create policy "audit_components_deny_update" on audit_components
  for update to anon, authenticated using (false);
create policy "audit_components_deny_delete" on audit_components
  for delete to anon, authenticated using (false);

-- ---------------------------------------------------------------------------
-- variable_uploads (plugin pairing-code handoff) — deny-all, service-role only
-- ---------------------------------------------------------------------------
create table if not exists variable_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  audit_id uuid references audits(id) on delete cascade,
  file_key text not null,
  pairing_code text not null unique,
  -- null until the plugin POSTs the variables; flat map of FigmaVariable
  payload jsonb,
  consumed boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_variable_uploads_pairing_code on variable_uploads (pairing_code);
create index if not exists idx_variable_uploads_audit_id on variable_uploads (audit_id);

alter table variable_uploads enable row level security;

-- Deny-all: only service-role server code (plugin route, worker) touches this.
create policy "variable_uploads_deny_select" on variable_uploads
  for select to anon, authenticated using (false);
create policy "variable_uploads_deny_insert" on variable_uploads
  for insert to anon, authenticated with check (false);
create policy "variable_uploads_deny_update" on variable_uploads
  for update to anon, authenticated using (false);
create policy "variable_uploads_deny_delete" on variable_uploads
  for delete to anon, authenticated using (false);

-- ---------------------------------------------------------------------------
-- classifications (replaces .ds-validation/<fileKey>-classifications.json)
-- ---------------------------------------------------------------------------
create table if not exists classifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_key text not null,
  -- Record<"componentName:checkId", "interactive"|"non-interactive"|"ambiguous">
  decisions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_classifications_user_file
  on classifications (user_id, file_key);

alter table classifications enable row level security;

-- Deny-all: only service-role server code reads/writes classifications.
create policy "classifications_deny_select" on classifications
  for select to anon, authenticated using (false);
create policy "classifications_deny_insert" on classifications
  for insert to anon, authenticated with check (false);
create policy "classifications_deny_update" on classifications
  for update to anon, authenticated using (false);
create policy "classifications_deny_delete" on classifications
  for delete to anon, authenticated using (false);

-- ---------------------------------------------------------------------------
-- updated_at triggers (reuse update_updated_at_column() from the first migration)
-- ---------------------------------------------------------------------------
create trigger set_audits_updated_at
  before update on audits
  for each row execute function update_updated_at_column();

create trigger set_classifications_updated_at
  before update on classifications
  for each row execute function update_updated_at_column();
