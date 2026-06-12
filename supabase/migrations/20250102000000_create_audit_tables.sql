-- Create tables for the audit lifecycle: drafts, runs, component results,
-- variable uploads (plugin pairing), and persistent classifications.

-- 1. audits: one row per audit run
create table if not exists audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_key text not null,
  file_name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'queued', 'running', 'done', 'error')),
  progress jsonb default '{}'::jsonb,
  selected_pages text[] default '{}',
  variable_source text
    check (variable_source is null or variable_source in ('rest-api', 'plugin', 'skip')),
  total_score integer,
  config jsonb default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_audits_user_id on audits (user_id);
create index idx_audits_status on audits (status);

-- RLS: users can only access their own audits
alter table audits enable row level security;

create policy "users_select_own" on audits for select
  to authenticated using (user_id = auth.uid());
create policy "users_insert_own" on audits for insert
  to authenticated with check (user_id = auth.uid());
create policy "users_update_own" on audits for update
  to authenticated using (user_id = auth.uid());
create policy "users_delete_own" on audits for delete
  to authenticated using (user_id = auth.uid());

-- Auto-update updated_at
create trigger set_audits_updated_at
  before update on audits
  for each row
  execute function update_updated_at_column();

-- 2. audit_components: per-component results for an audit
create table if not exists audit_components (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references audits(id) on delete cascade,
  component_name text not null,
  page_name text not null,
  score integer not null,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_components_audit_id on audit_components (audit_id);

alter table audit_components enable row level security;

create policy "users_select_own_components" on audit_components for select
  to authenticated using (
    audit_id in (select id from audits where user_id = auth.uid())
  );
create policy "users_insert_own_components" on audit_components for insert
  to authenticated with check (
    audit_id in (select id from audits where user_id = auth.uid())
  );

-- 3. variable_uploads: plugin pairing codes for uploading variables
-- The plugin has no user session, so inserts are allowed without auth.
-- The pairing_code is a short-lived, single-use key.
create table if not exists variable_uploads (
  pairing_code text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_key text not null,
  payload jsonb,
  consumed boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index idx_variable_uploads_user_id on variable_uploads (user_id);

-- Allow unauthenticated inserts (plugin has no session).
-- The service-role key and validation in route handlers enforce code validity.
alter table variable_uploads enable row level security;

create policy "anyone_insert_variable_upload" on variable_uploads for insert
  to anon, authenticated with check (true);
create policy "users_select_own_uploads" on variable_uploads for select
  to authenticated using (user_id = auth.uid());
create policy "users_update_own_uploads" on variable_uploads for update
  to authenticated using (user_id = auth.uid());

-- 4. classifications: persistent per-user per-file classification decisions
create table if not exists classifications (
  user_id uuid not null references auth.users(id) on delete cascade,
  file_key text not null,
  decisions jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, file_key)
);

alter table classifications enable row level security;

create policy "users_select_own_classifications" on classifications for select
  to authenticated using (user_id = auth.uid());
create policy "users_insert_own_classifications" on classifications for insert
  to authenticated with check (user_id = auth.uid());
create policy "users_update_own_classifications" on classifications for update
  to authenticated using (user_id = auth.uid());
create policy "users_delete_own_classifications" on classifications for delete
  to authenticated using (user_id = auth.uid());