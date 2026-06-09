-- ============================================================
-- 002 — Busy sync tracking tables
-- Run in Supabase SQL Editor AFTER 001_initial_schema.sql
-- ============================================================

-- Sync result log written by the Python agent after every cycle
create table sync_log (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz default now(),
  store_id       uuid references stores not null,
  started_at     timestamptz not null,
  completed_at   timestamptz,
  status         text not null check (status in ('running','success','error')),
  items_synced   int not null default 0,
  serials_synced int not null default 0,
  error_msg      text
);
create index idx_sync_log_store_ts on sync_log(store_id, created_at desc);

-- On-demand trigger written by the app, consumed by the Python agent
create table sync_requests (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  store_id     uuid references stores not null,
  requested_by text,
  processed_at timestamptz
);

-- RLS
alter table sync_log      enable row level security;
alter table sync_requests enable row level security;

create policy "sync_log_store"      on sync_log      for all using (store_id = auth_store_id());
create policy "sync_requests_store" on sync_requests for all using (store_id = auth_store_id());
