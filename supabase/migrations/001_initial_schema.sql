-- ============================================================
-- ACS·OS — Full Schema Migration (Phase 1 baseline + Ph 6-11 extensions)
-- Apply once in Supabase SQL editor. Later phases add features, not tables.
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";  -- fuzzy search

-- ─────────────────────────────────────────────
-- CORE TABLES
-- ─────────────────────────────────────────────

create table stores (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  name        text not null,
  address     text,
  gstin       text,
  phone       text,
  email       text
);

create table profiles (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  user_id     uuid references auth.users on delete cascade not null unique,
  role        text not null check (role in ('owner','staff','viewer','technician')),
  store_id    uuid references stores not null,
  name        text not null,
  lang        text not null default 'en' check (lang in ('en','bn')),
  phone       text,
  is_active   bool not null default true
);

create table number_sequences (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  store_id    uuid references stores not null,
  kind        text not null check (kind in ('quote','po','tender','job','invoice','proforma','transfer')),
  next_val    int not null default 1,
  unique(store_id, kind)
);

create table products (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  store_id     uuid references stores not null,
  name         text not null,
  norm_name    text not null,
  cat          text,
  cost         numeric(12,2),
  sell         numeric(12,2),
  floor        numeric(12,2),
  tender_floor numeric(12,2),
  market_ref   numeric(12,2),
  market_match text,
  gst_pct      numeric(5,2) not null default 18,
  stock_qty    int not null default 0,
  reserved_qty int not null default 0,   -- stock reservation
  low_stock_threshold int not null default 2,
  archived     bool not null default false,
  busy_item_id text,                      -- Busy item reference
  last_synced  timestamptz
);

create index idx_products_norm_name on products using gin(norm_name gin_trgm_ops);
create index idx_products_store on products(store_id);
create index idx_products_busy on products(busy_item_id) where busy_item_id is not null;

create table product_compat (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz default now(),
  product_id           uuid references products on delete cascade,
  compatible_product_id uuid references products on delete cascade,
  unique(product_id, compatible_product_id)
);

create table serials (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  product_id      uuid references products on delete cascade not null,
  serial_no       text not null,
  status          text not null default 'available' check (status in ('available','reserved','sold','rma','loaner')),
  purchase_date   date,
  warranty_months int not null default 12,
  sold_to         uuid null,   -- fk added after customers table
  sold_date       date,
  busy_serial_id  text,           -- Busy Serial Number feature ID
  last_synced     timestamptz,
  unique(product_id, serial_no)
);

create index idx_serials_product_status on serials(product_id, status);
create index idx_serials_busy on serials(busy_serial_id) where busy_serial_id is not null;

create table stock_moves (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  product_id  uuid references products on delete cascade not null,
  serial_id   uuid references serials null,
  store_id    uuid references stores not null,
  qty         int not null,
  type        text not null check (type in ('in','out','adjust','reserve','unreserve','transfer_in','transfer_out')),
  ref_table   text,
  ref_id      uuid,
  note        text,
  ts          timestamptz not null default now()
);
create index idx_stock_moves_product_ts on stock_moves(product_id, ts);

-- ─────────────────────────────────────────────
-- CUSTOMERS & SUPPLIERS
-- ─────────────────────────────────────────────

create table customers (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  store_id        uuid references stores not null,
  name            text not null,
  phone           text,
  email           text,
  gstin           text,
  address         text,
  dob             date,            -- for birthday nudge
  anniversary     date,
  note            text,
  rate_contract   jsonb,
  portal_enabled  bool not null default false,
  portal_phone    text,            -- login phone for self-service portal
  opt_out_wa      bool not null default false  -- WhatsApp opt-out
);

-- Add deferred FK now that customers exists
alter table serials add constraint fk_serials_sold_to
  foreign key (sold_to) references customers(id);

create table suppliers (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  store_id    uuid references stores not null,
  name        text not null,
  phone       text,
  email       text,
  gstin       text,
  last_rates  jsonb,
  advance_bal numeric(12,2) not null default 0  -- distributor advance balance
);

-- ─────────────────────────────────────────────
-- QUOTING & SALES
-- ─────────────────────────────────────────────

create table quotes (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz default now(),
  store_id         uuid references stores not null,
  number           int not null,
  customer_id      uuid references customers,
  by_user          uuid references profiles not null,
  status           text not null default 'open' check (status in ('open','win','lost')),
  total            numeric(12,2),
  source_tender_id uuid null,   -- fk added after tenders table
  public_token     text unique,
  token_expires_at timestamptz,
  accepted         bool not null default false,
  quote_type       text not null default 'quote' check (quote_type in ('quote','proforma')),
  draft_data       jsonb,          -- auto-save draft
  draft_saved_at   timestamptz,
  unique(store_id, number)
);

create table quote_lines (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  quote_id    uuid references quotes on delete cascade not null,
  product_id  uuid references products not null,
  qty         int not null default 1,
  unit_price  numeric(12,2) not null,
  gst_pct     numeric(5,2) not null default 18,
  serial_id   uuid references serials null
);

create table quote_bundles (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  store_id    uuid references stores not null,
  name        text not null,
  lines       jsonb not null
);

create table sales (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  quote_id     uuid references quotes null,
  store_id     uuid references stores not null,
  customer_id  uuid references customers,
  by_user      uuid references profiles not null,
  date         date not null default current_date,
  total        numeric(12,2) not null,
  invoice_no   text,    -- GST tax invoice number
  invoice_type text not null default 'sale' check (invoice_type in ('sale','return'))
);

create table sale_lines (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  sale_id     uuid references sales on delete cascade not null,
  product_id  uuid references products not null,
  serial_id   uuid references serials null,
  qty         int not null,
  unit_price  numeric(12,2) not null,
  gst_pct     numeric(5,2) not null default 18,
  is_refurb   bool not null default false
);

create table payments (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  sale_id     uuid references sales null,
  customer_id uuid references customers not null,
  amount      numeric(12,2) not null,
  date        date not null default current_date,
  mode        text not null default 'cash' check (mode in ('cash','upi','card','neft','cheque','advance','other')),
  upi_ref     text,
  note        text
);

create table credit_notes (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  store_id    uuid references stores not null,
  sale_id     uuid references sales not null,
  customer_id uuid references customers not null,
  amount      numeric(12,2) not null,
  reason      text,
  by_user     uuid references profiles not null
);

-- ─────────────────────────────────────────────
-- SERVICE & RELATIONSHIPS
-- ─────────────────────────────────────────────

create table customer_assets (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz default now(),
  customer_id      uuid references customers not null,
  serial_id        uuid references serials null,
  product_id       uuid references products not null,
  sold_date        date,
  amc_contract_id  uuid null  -- filled when AMC added
);

create table service_tickets (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  store_id     uuid references stores not null,
  customer_id  uuid references customers not null,
  serial_id    uuid references serials null,
  issue        text not null,
  assigned_to  uuid references profiles null,
  status       text not null default 'open' check (status in ('open','in_progress','closed')),
  is_warranty  bool not null default false
);

create table amc_contracts (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  store_id        uuid references stores not null,
  customer_id     uuid references customers not null,
  scope           text,
  value           numeric(12,2),
  start_date      date not null,
  end_date        date not null,
  visits_allowed  int not null default 12,
  visits_used     int not null default 0
);

create table amc_visits (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz default now(),
  amc_contract_id  uuid references amc_contracts not null,
  date             date not null,
  ticket_id        uuid references service_tickets null,
  note             text
);

create table rma_cases (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz default now(),
  serial_id           uuid references serials not null,
  oem                 text,
  sent_date           date,
  expected_return     date,
  replacement_serial  text,
  status              text not null default 'sent' check (status in ('sent','received','replaced','closed'))
);

create table renewals (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  store_id     uuid references stores not null,
  customer_id  uuid references customers not null,
  item         text not null,
  type         text not null check (type in ('software','hosting','antivirus','amc','other')),
  expiry       date not null,
  amount       numeric(12,2),
  reminded     bool not null default false
);
create index idx_renewals_expiry on renewals(expiry);

create table loaners (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  store_id     uuid references stores not null,
  product_id   uuid references products not null,
  serial_id    uuid references serials null,
  customer_id  uuid references customers not null,
  out_date     date not null,
  due_date     date not null,
  returned     bool not null default false
);

-- ─────────────────────────────────────────────
-- TENDERS & PURCHASING
-- ─────────────────────────────────────────────

create table tenders (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  store_id     uuid references stores not null,
  title        text not null,
  dept         text,
  portal       text check (portal in ('gem','cppp','wb','private')),
  tender_id    text,
  emd_amount   numeric(12,2),
  deadline     timestamptz,
  status       text not null default 'watching' check (status in ('watching','preparing','submitted','win','lost')),
  loss_reason  text
);
create index idx_tenders_deadline on tenders(deadline);

-- Add deferred FK now that tenders exists
alter table quotes add constraint fk_quotes_source_tender
  foreign key (source_tender_id) references tenders(id);

create table tender_items (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz default now(),
  tender_id           uuid references tenders on delete cascade not null,
  raw_line            text,
  matched_product_id  uuid references products null,
  qty                 int not null default 1,
  unit_price          numeric(12,2),
  matched             bool not null default false
);

create table tender_documents (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  tender_id    uuid references tenders null,
  doc_type     text not null,
  storage_path text not null
);

create table emd_records (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  tender_id    uuid references tenders not null,
  amount       numeric(12,2) not null,
  paid_date    date,
  refunded     bool not null default false
);

create table oem_authorizations (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  store_id     uuid references stores not null,
  oem          text not null,
  valid_from   date,
  valid_to     date,
  storage_path text
);

create table purchase_orders (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz default now(),
  store_id       uuid references stores not null,
  number         int not null,
  supplier_id    uuid references suppliers not null,
  status         text not null default 'draft' check (status in ('draft','sent','confirmed','received','cancelled')),
  source_demand  jsonb,
  draft_data     jsonb,
  draft_saved_at timestamptz,
  unique(store_id, number)
);

create table po_lines (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  po_id       uuid references purchase_orders on delete cascade not null,
  product_id  uuid references products not null,
  qty         int not null,
  rate        numeric(12,2)
);

create table price_list_imports (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  supplier_id  uuid references suppliers not null,
  filename     text,
  imported_at  timestamptz not null default now()
);

create table market_refs (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  product_id  uuid references products not null,
  source      text,
  price       numeric(12,2),
  fetched_at  timestamptz not null default now()
);

create table interest_profiles (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  store_id     uuid references stores not null,
  keywords     text[],
  location     text,
  min_value    numeric(12,2),
  max_value    numeric(12,2)
);

-- ─────────────────────────────────────────────
-- PHASE 6 — SERVICE & REPAIR (job cards)
-- ─────────────────────────────────────────────

create table job_cards (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz default now(),
  store_id          uuid references stores not null,
  number            int not null,
  customer_id       uuid references customers not null,
  device_desc       text not null,
  condition_in      text,
  accessories       text[],
  complaint         text not null,
  intake_photos     text[],
  status            text not null default 'received'
    check (status in ('received','diagnosed','estimate_sent','approved','in_repair','testing','ready','delivered','cancelled')),
  assigned_to       uuid references profiles null,
  estimate_amount   numeric(12,2),
  labour_charge     numeric(12,2) not null default 0,
  final_amount      numeric(12,2),
  approved_at       timestamptz,
  ready_at          timestamptz,
  delivered_at      timestamptz,
  public_token      text unique,
  token_expires_at  timestamptz,
  is_outside        bool not null default false,
  outside_vendor    text,
  outside_sent_date date,
  outside_expected  date,
  sla_days          int not null default 5,
  is_warranty_claim bool not null default false,
  unique(store_id, number)
);
create index idx_job_cards_status on job_cards(status);
create index idx_job_cards_customer on job_cards(customer_id);

create table job_parts (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  job_card_id  uuid references job_cards on delete cascade not null,
  product_id   uuid references products null,
  serial_id    uuid references serials null,
  description  text not null,
  qty          int not null default 1,
  rate         numeric(12,2) not null
);

create table job_status_log (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  job_card_id  uuid references job_cards not null,
  status       text not null,
  by_user      uuid references profiles not null,
  note         text,
  ts           timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- PHASE 7 — EXCHANGE & REFURB
-- ─────────────────────────────────────────────

create table tradeins (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz default now(),
  store_id       uuid references stores not null,
  customer_id    uuid references customers not null,
  device_desc    text not null,
  condition_grade text check (condition_grade in ('A','B','C','D')),
  assessed_value numeric(12,2) not null,
  applied_sale_id uuid references sales null,
  taken_date     date not null default current_date
);

create table refurb_stock (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz default now(),
  store_id          uuid references stores not null,
  source_tradein_id uuid references tradeins null,
  product_desc      text not null,
  condition_grade   text check (condition_grade in ('A','B','C','D')),
  cost_basis        numeric(12,2) not null,
  resale_price      numeric(12,2),
  warranty_months   int not null default 3,
  status            text not null default 'in_refurb' check (status in ('in_refurb','available','sold')),
  sold_sale_id      uuid references sales null
);

create table buybacks (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  store_id     uuid references stores not null,
  customer_id  uuid references customers not null,
  device_desc  text not null,
  amount       numeric(12,2) not null,
  date         date not null default current_date
);

-- ─────────────────────────────────────────────
-- PHASE 8 — CLIENTELE & SPEND
-- ─────────────────────────────────────────────

create table customer_spend (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  customer_id  uuid references customers not null,
  store_id     uuid references stores not null,
  source       text not null check (source in ('sale','repair','amc','renewal','exchange','other')),
  ref_id       uuid,
  amount       numeric(12,2) not null,
  profit       numeric(12,2),   -- owner only
  date         date not null
);
create index idx_customer_spend_cust_date on customer_spend(customer_id, date);

create table customer_credit (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  customer_id     uuid references customers not null unique,
  credit_limit    numeric(12,2) not null default 0,
  current_balance numeric(12,2) not null default 0
);

-- ─────────────────────────────────────────────
-- PHASE 9 — WHATSAPP
-- ─────────────────────────────────────────────

create table wa_messages (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  customer_id  uuid references customers null,
  to_phone     text not null,
  template     text,
  body         text not null,
  ref_table    text,
  ref_id       uuid,
  status       text not null default 'queued' check (status in ('queued','sent','failed','manual')),
  sent_at      timestamptz,
  wa_link      text   -- pre-filled wa.me link for manual send
);
create index idx_wa_messages_status on wa_messages(status);

create table wa_settings (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  store_id     uuid references stores not null unique,
  provider     text not null default 'manual' check (provider in ('manual','aisensy','interakt','wati')),
  api_config   jsonb
);

-- ─────────────────────────────────────────────
-- PHASE 10 — STAFF PERFORMANCE
-- ─────────────────────────────────────────────

create table staff_targets (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  profile_id   uuid references profiles not null,
  period       text not null,  -- e.g. '2024-07'
  metric       text not null,
  target       numeric(12,2) not null,
  unique(profile_id, period, metric)
);

-- ─────────────────────────────────────────────
-- PHASE 11 — CASH & EXPENSE
-- ─────────────────────────────────────────────

create table expense_categories (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  store_id    uuid references stores not null,
  name        text not null,
  unique(store_id, name)
);

create table cash_entries (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  store_id     uuid references stores not null,
  direction    text not null check (direction in ('in','out')),
  category     text not null,
  amount       numeric(12,2) not null,
  note         text,
  ref_table    text,
  ref_id       uuid,
  date         date not null default current_date,
  by_user      uuid references profiles not null
);
create index idx_cash_entries_store_date on cash_entries(store_id, date);

-- ─────────────────────────────────────────────
-- CROSS-PHASE
-- ─────────────────────────────────────────────

create table stock_transfers (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz default now(),
  from_store_id  uuid references stores not null,
  to_store_id    uuid references stores not null,
  product_id     uuid references products not null,
  serial_id      uuid references serials null,
  qty            int not null,
  note           text,
  by_user        uuid references profiles not null,
  status         text not null default 'pending' check (status in ('pending','in_transit','received','cancelled'))
);

create table delivery_tracking (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  store_id     uuid references stores not null,
  sale_id      uuid references sales not null,
  courier      text,
  tracking_no  text,
  dispatch_date date,
  expected_date date,
  status       text not null default 'pending' check (status in ('pending','dispatched','in_transit','delivered','returned')),
  note         text
);

create table distributor_advances (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  store_id      uuid references stores not null,
  supplier_id   uuid references suppliers not null,
  amount        numeric(12,2) not null,
  paid_date     date not null,
  adjusted_amt  numeric(12,2) not null default 0,
  note          text
);

create table supplier_debit_notes (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  store_id      uuid references stores not null,
  supplier_id   uuid references suppliers not null,
  po_id         uuid references purchase_orders null,
  amount        numeric(12,2) not null,
  reason        text,
  date          date not null default current_date,
  by_user       uuid references profiles not null
);

create table activity_log (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  user_id     uuid references profiles not null,
  store_id    uuid references stores not null,
  action      text not null,
  entity      text not null,
  entity_id   uuid,
  detail      jsonb,
  ts          timestamptz not null default now()
);
create index idx_activity_log_ts on activity_log(ts);
create index idx_activity_log_user on activity_log(user_id, ts);

create table settings (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  store_id    uuid references stores not null,
  key         text not null,
  value       jsonb not null,
  unique(store_id, key)
);

create table webauthn_credentials (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  user_id      uuid references auth.users on delete cascade not null,
  credential_id text not null unique,
  public_key   text not null,
  counter      bigint not null default 0,
  device_name  text,
  last_used    timestamptz
);

-- ─────────────────────────────────────────────
-- SAFE VIEWS (role-gated)
-- ─────────────────────────────────────────────

-- Staff-safe product view: never exposes cost, floor, tender_floor
create or replace view products_public as
  select
    id, store_id, name, norm_name, cat,
    sell, gst_pct,
    (stock_qty - reserved_qty) as stock,
    reserved_qty,
    low_stock_threshold,
    market_ref, archived
  from products;

-- ─────────────────────────────────────────────
-- ROW-LEVEL SECURITY
-- ─────────────────────────────────────────────

-- Enable RLS on all tables
alter table stores                 enable row level security;
alter table profiles               enable row level security;
alter table number_sequences       enable row level security;
alter table products               enable row level security;
alter table product_compat         enable row level security;
alter table serials                enable row level security;
alter table stock_moves            enable row level security;
alter table customers              enable row level security;
alter table suppliers              enable row level security;
alter table quotes                 enable row level security;
alter table quote_lines            enable row level security;
alter table quote_bundles          enable row level security;
alter table sales                  enable row level security;
alter table sale_lines             enable row level security;
alter table payments               enable row level security;
alter table credit_notes           enable row level security;
alter table customer_assets        enable row level security;
alter table service_tickets        enable row level security;
alter table amc_contracts          enable row level security;
alter table amc_visits             enable row level security;
alter table rma_cases              enable row level security;
alter table renewals               enable row level security;
alter table loaners                enable row level security;
alter table tenders                enable row level security;
alter table tender_items           enable row level security;
alter table tender_documents       enable row level security;
alter table emd_records            enable row level security;
alter table oem_authorizations     enable row level security;
alter table purchase_orders        enable row level security;
alter table po_lines               enable row level security;
alter table price_list_imports     enable row level security;
alter table market_refs            enable row level security;
alter table interest_profiles      enable row level security;
alter table job_cards              enable row level security;
alter table job_parts              enable row level security;
alter table job_status_log         enable row level security;
alter table tradeins               enable row level security;
alter table refurb_stock           enable row level security;
alter table buybacks               enable row level security;
alter table customer_spend         enable row level security;
alter table customer_credit        enable row level security;
alter table wa_messages            enable row level security;
alter table wa_settings            enable row level security;
alter table staff_targets          enable row level security;
alter table expense_categories     enable row level security;
alter table cash_entries           enable row level security;
alter table stock_transfers        enable row level security;
alter table delivery_tracking      enable row level security;
alter table distributor_advances   enable row level security;
alter table supplier_debit_notes   enable row level security;
alter table activity_log           enable row level security;
alter table settings               enable row level security;
alter table webauthn_credentials   enable row level security;

-- Helper: get current user's store_id
create or replace function auth_store_id()
returns uuid language sql stable security definer as $$
  select store_id from profiles where user_id = auth.uid()
$$;

-- Helper: get current user's role
create or replace function auth_role()
returns text language sql stable security definer as $$
  select role from profiles where user_id = auth.uid()
$$;

-- Profiles: own row only
create policy "profiles_select" on profiles for select using (user_id = auth.uid());
create policy "profiles_update" on profiles for update using (user_id = auth.uid());

-- Stores: members of that store
create policy "stores_select" on stores for select using (id = auth_store_id());

-- Products: store members (staff use products_public view — this policy is for owner)
create policy "products_store" on products for all using (store_id = auth_store_id());

-- Products_public view: all authenticated users in the store
-- (view already filters columns; RLS on underlying table enforces store_id)

-- Serials: store members
create policy "serials_store" on serials for all using (
  product_id in (select id from products where store_id = auth_store_id())
);

-- Customers: store members
create policy "customers_store" on customers for all using (store_id = auth_store_id());

-- Quotes: store members
create policy "quotes_store" on quotes for all using (store_id = auth_store_id());

-- Sales: store members
create policy "sales_store" on sales for all using (store_id = auth_store_id());

-- Job cards: store members; technician sees only assigned ones
create policy "job_cards_store" on job_cards for select using (
  store_id = auth_store_id()
  and (
    auth_role() in ('owner','staff','viewer')
    or assigned_to = (select id from profiles where user_id = auth.uid())
  )
);
create policy "job_cards_write" on job_cards for insert with check (store_id = auth_store_id());
create policy "job_cards_update" on job_cards for update using (
  store_id = auth_store_id()
  and (
    auth_role() in ('owner','staff')
    or assigned_to = (select id from profiles where user_id = auth.uid())
  )
);

-- Activity log: store members
create policy "activity_log_store" on activity_log for select using (store_id = auth_store_id());
create policy "activity_log_insert" on activity_log for insert with check (store_id = auth_store_id());

-- WebAuthn: own credentials only
create policy "webauthn_own" on webauthn_credentials for all using (user_id = auth.uid());

-- Generic store-scoped policies for remaining tables
create policy "number_seq_store"    on number_sequences    for all using (store_id = auth_store_id());
create policy "stock_moves_store"   on stock_moves         for all using (store_id = auth_store_id());
create policy "suppliers_store"     on suppliers           for all using (store_id = auth_store_id());
create policy "quote_lines_store"   on quote_lines         for all using (quote_id in (select id from quotes where store_id = auth_store_id()));
create policy "quote_bundles_store" on quote_bundles       for all using (store_id = auth_store_id());
create policy "sale_lines_store"    on sale_lines          for all using (sale_id in (select id from sales where store_id = auth_store_id()));
create policy "payments_store"      on payments            for all using (customer_id in (select id from customers where store_id = auth_store_id()));
create policy "credit_notes_store"  on credit_notes        for all using (store_id = auth_store_id());
create policy "tenders_store"       on tenders             for all using (store_id = auth_store_id());
create policy "po_store"            on purchase_orders     for all using (store_id = auth_store_id());
create policy "settings_store"      on settings            for all using (store_id = auth_store_id());
create policy "wa_settings_store"   on wa_settings         for all using (store_id = auth_store_id());
create policy "cash_entries_store"  on cash_entries        for all using (store_id = auth_store_id());
create policy "stock_transfer_store" on stock_transfers    for all using (from_store_id = auth_store_id() or to_store_id = auth_store_id());
create policy "delivery_store"      on delivery_tracking   for all using (store_id = auth_store_id());
create policy "dist_advances_store" on distributor_advances for all using (store_id = auth_store_id());
create policy "debit_notes_store"   on supplier_debit_notes for all using (store_id = auth_store_id());
create policy "customer_spend_store" on customer_spend     for all using (store_id = auth_store_id());
create policy "job_parts_store"     on job_parts           for all using (job_card_id in (select id from job_cards where store_id = auth_store_id()));
create policy "job_log_store"       on job_status_log      for all using (job_card_id in (select id from job_cards where store_id = auth_store_id()));
create policy "tradeins_store"      on tradeins            for all using (store_id = auth_store_id());
create policy "refurb_store"        on refurb_stock        for all using (store_id = auth_store_id());
create policy "buybacks_store"      on buybacks            for all using (store_id = auth_store_id());
create policy "wa_msg_store"        on wa_messages         for all using (customer_id in (select id from customers where store_id = auth_store_id()));
create policy "renewals_store"      on renewals            for all using (store_id = auth_store_id());
create policy "expense_cat_store"   on expense_categories  for all using (store_id = auth_store_id());
create policy "oem_auth_store"      on oem_authorizations  for all using (store_id = auth_store_id());
create policy "interest_store"      on interest_profiles   for all using (store_id = auth_store_id());

-- ─────────────────────────────────────────────
-- TRANSACTIONAL NUMBER ALLOCATION FUNCTION
-- ─────────────────────────────────────────────

create or replace function allocate_number(p_store_id uuid, p_kind text)
returns int language plpgsql security definer as $$
declare
  v_val int;
begin
  update number_sequences
  set    next_val = next_val + 1
  where  store_id = p_store_id and kind = p_kind
  returning next_val - 1 into v_val;

  if v_val is null then
    insert into number_sequences(store_id, kind, next_val)
    values (p_store_id, p_kind, 2)
    returning 1 into v_val;
    v_val := 1;
  end if;

  return v_val;
end;
$$;

-- ─────────────────────────────────────────────
-- NORMALIZE NAME FUNCTION (fuzzy search helper)
-- ─────────────────────────────────────────────

create or replace function normalize_name(p_name text)
returns text language sql immutable as $$
  select lower(regexp_replace(trim(p_name), '[^a-z0-9]+', ' ', 'gi'))
$$;

-- Trigger to auto-set norm_name on products
create or replace function set_norm_name()
returns trigger language plpgsql as $$
begin
  new.norm_name := normalize_name(new.name);
  return new;
end;
$$;

create trigger products_norm_name
  before insert or update of name on products
  for each row execute function set_norm_name();

-- ─────────────────────────────────────────────
-- SEED DATA
-- ─────────────────────────────────────────────

-- Stores
insert into stores (id, name, address, gstin, phone, email) values
  ('11111111-1111-1111-1111-111111111111', 'Advanced Computer System', 'Burdwan, West Bengal', '19AAAAA0000A1Z5', '+91 81700 18080', 'acsbdn@gmail.com'),
  ('22222222-2222-2222-2222-222222222222', 'Adi Shree Hari', 'Burdwan, West Bengal', NULL, NULL, NULL);

-- Number sequences
insert into number_sequences (store_id, kind, next_val) values
  ('11111111-1111-1111-1111-111111111111', 'quote', 1001),
  ('11111111-1111-1111-1111-111111111111', 'po', 1),
  ('11111111-1111-1111-1111-111111111111', 'tender', 1),
  ('11111111-1111-1111-1111-111111111111', 'job', 1),
  ('11111111-1111-1111-1111-111111111111', 'invoice', 1),
  ('11111111-1111-1111-1111-111111111111', 'proforma', 1),
  ('11111111-1111-1111-1111-111111111111', 'transfer', 1),
  ('22222222-2222-2222-2222-222222222222', 'quote', 2001),
  ('22222222-2222-2222-2222-222222222222', 'po', 1),
  ('22222222-2222-2222-2222-222222222222', 'job', 1);

-- Default settings per store
insert into settings (store_id, key, value) values
  ('11111111-1111-1111-1111-111111111111', 'renewal_alert_days', '30'),
  ('11111111-1111-1111-1111-111111111111', 'job_sla_days', '5'),
  ('11111111-1111-1111-1111-111111111111', 'dormancy_days', '90'),
  ('11111111-1111-1111-1111-111111111111', 'spend_tier_platinum', '100000'),
  ('11111111-1111-1111-1111-111111111111', 'spend_tier_gold', '50000'),
  ('11111111-1111-1111-1111-111111111111', 'spend_tier_silver', '20000'),
  ('22222222-2222-2222-2222-222222222222', 'renewal_alert_days', '30'),
  ('22222222-2222-2222-2222-222222222222', 'job_sla_days', '5');

-- WhatsApp settings (manual by default)
insert into wa_settings (store_id, provider) values
  ('11111111-1111-1111-1111-111111111111', 'manual'),
  ('22222222-2222-2222-2222-222222222222', 'manual');

-- Sample products for ACS store
insert into products (store_id, name, norm_name, cat, cost, sell, floor, tender_floor, gst_pct, stock_qty) values
  ('11111111-1111-1111-1111-111111111111', 'HP 24f Monitor 23.8"',         normalize_name('HP 24f Monitor 23.8"'),        'Monitor',   7500, 9500, 8200, 7800, 18, 5),
  ('11111111-1111-1111-1111-111111111111', 'Dell Keyboard KB216',           normalize_name('Dell Keyboard KB216'),          'Keyboard',   500,  850,  650,  600, 18, 12),
  ('11111111-1111-1111-1111-111111111111', 'Logitech Mouse M100',           normalize_name('Logitech Mouse M100'),          'Mouse',      280,  450,  350,  320, 18, 8),
  ('11111111-1111-1111-1111-111111111111', 'Seagate 1TB HDD',               normalize_name('Seagate 1TB HDD'),              'Storage',   2200, 3200, 2600, 2400, 18, 6),
  ('11111111-1111-1111-1111-111111111111', 'Kingston 8GB DDR4 RAM',         normalize_name('Kingston 8GB DDR4 RAM'),        'RAM',       1400, 2000, 1650, 1500, 18, 10),
  ('11111111-1111-1111-1111-111111111111', 'HP LaserJet M110w Printer',     normalize_name('HP LaserJet M110w Printer'),    'Printer',  10500,14500,11800,11000, 18, 3),
  ('11111111-1111-1111-1111-111111111111', 'TP-Link WiFi Router TL-WR840N', normalize_name('TP-Link WiFi Router TL-WR840N'),'Networking', 700, 1100,  850,  780, 18, 7);

-- Default expense categories
insert into expense_categories (store_id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Rent'),
  ('11111111-1111-1111-1111-111111111111', 'Salaries'),
  ('11111111-1111-1111-1111-111111111111', 'Electricity'),
  ('11111111-1111-1111-1111-111111111111', 'Transport'),
  ('11111111-1111-1111-1111-111111111111', 'Petty Cash'),
  ('11111111-1111-1111-1111-111111111111', 'Supplier Payment'),
  ('11111111-1111-1111-1111-111111111111', 'Other'),
  ('22222222-2222-2222-2222-222222222222', 'Rent'),
  ('22222222-2222-2222-2222-222222222222', 'Salaries'),
  ('22222222-2222-2222-2222-222222222222', 'Other');
