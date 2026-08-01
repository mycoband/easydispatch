-- Run once in Supabase SQL Editor after schema.sql
-- Office features: pricebook, portal tokens, job flags, agreement type, customer access notes

-- ========== PRICEBOOK ==========
create table if not exists public.pricebook_items (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  category text default 'General',
  unit_price numeric(12,2) default 0,
  taxable boolean default true,
  active boolean default true,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ========== PORTAL TOKENS (customer lite) ==========
create table if not exists public.portal_tokens (
  id uuid primary key default uuid_generate_v4(),
  token text unique not null,
  customer_id uuid references public.customers(id) on delete cascade,
  estimate_id uuid references public.estimates(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  purpose text not null check (purpose in ('estimate', 'invoice')),
  expires_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists portal_tokens_token_idx on public.portal_tokens (token);

-- ========== JOB FLAGS + CUSTOMER SUMMARY ==========
alter table public.jobs add column if not exists customer_summary text;
alter table public.jobs add column if not exists is_callback boolean default false;
alter table public.jobs add column if not exists warranty_flag boolean default false;

-- ========== CUSTOMER ACCESS ==========
alter table public.customers add column if not exists access_notes text;

-- ========== AGREEMENTS: membership vs PM ==========
alter table public.service_agreements
  add column if not exists agreement_type text default 'pm'
  check (agreement_type in ('pm', 'membership'));

alter table public.service_agreements
  add column if not exists last_pm_job_id uuid references public.jobs(id) on delete set null;

-- Seed a starter pricebook if empty
insert into public.pricebook_items (name, description, category, unit_price, taxable, sort_order)
select * from (values
  ('Diagnostic', 'Diagnostic / trip charge', 'Labor', 89::numeric, true, 1),
  ('Labor hour', 'Labor – technician hour', 'Labor', 125::numeric, true, 2),
  ('Capacitor', 'Run capacitor replacement', 'Parts', 185::numeric, true, 3),
  ('Contactor', 'Contactor replacement', 'Parts', 225::numeric, true, 4),
  ('Filter change', 'Filter change (standard)', 'Maintenance', 45::numeric, true, 5),
  ('Tune-up', 'Seasonal maintenance / tune-up', 'Maintenance', 149::numeric, true, 6),
  ('Drain clear', 'Condensate drain clear', 'Service', 95::numeric, true, 7)
) as v(name, description, category, unit_price, taxable, sort_order)
where not exists (select 1 from public.pricebook_items limit 1);

-- RLS
alter table public.pricebook_items enable row level security;
alter table public.portal_tokens enable row level security;

drop policy if exists "Authenticated full access to pricebook" on public.pricebook_items;
create policy "Authenticated full access to pricebook" on public.pricebook_items
  for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated full access to portal_tokens" on public.portal_tokens;
create policy "Authenticated full access to portal_tokens" on public.portal_tokens
  for all to authenticated using (true) with check (true);

-- Public read of portal rows is via service role in API; no anon policy needed

grant all on public.pricebook_items to postgres, anon, authenticated, service_role;
grant all on public.portal_tokens to postgres, anon, authenticated, service_role;
