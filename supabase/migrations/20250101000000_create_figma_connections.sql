-- Create the figma_connections table for storing encrypted Figma tokens.
-- RLS ensures only the service-role (server code) can read/write the table.
-- End users see connection metadata only through API routes.

create table if not exists figma_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('oauth', 'pat')),
  encrypted_access_token text not null,
  encrypted_refresh_token text,
  figma_user_id text,
  figma_user_handle text,
  figma_user_img_url text,
  granted_scopes text[],
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_figma_connections_user_id on figma_connections (user_id);

-- Enable RLS
alter table figma_connections enable row level security;

-- Deny all operations for anon/authenticated users. Only service-role (server
-- code) reads/writes this table. The client sees connection status through
-- an API route that uses the service-role key.
create policy "deny_select_for_users"   on figma_connections for select   to anon, authenticated using (false);
create policy "deny_insert_for_users"   on figma_connections for insert   to anon, authenticated with check (false);
create policy "deny_update_for_users"   on figma_connections for update   to anon, authenticated using (false);
create policy "deny_delete_for_users"   on figma_connections for delete   to anon, authenticated using (false);

-- Auto-update updated_at on row change
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on figma_connections
  for each row
  execute function update_updated_at_column();
