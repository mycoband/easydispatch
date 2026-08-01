-- EasyDispatch competitive features (run once after tech-features.sql)
-- 1 Properties  2 Company  3 Confirmations  4 Warranties  5 Part orders
-- 6 Tech skills  7 GPS cols already on jobs  8 Export (app-only)
-- 9 Membership billing  10 GBB estimate packages

-- ========== 1. PROPERTIES / SITES ==========
create table if not exists public.properties (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references public.customers(id) on delete cascade not null,
  name text not null default 'Primary',
  address text,
  city text,
  state text default 'MO',
  zip text,
  access_notes text,
  gate_code text,
  lockbox_code text,
  notes text,
  is_primary boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists properties_customer_idx on public.properties (customer_id);

alter table public.equipment
  add column if not exists property_id uuid references public.properties(id) on delete set null;

alter table public.jobs
  add column if not exists property_id uuid references public.properties(id) on delete set null;

-- Backfill one primary property per customer that has none
insert into public.properties (
  customer_id, name, address, city, state, zip, access_notes, is_primary
)
select
  c.id,
  'Primary',
  c.address,
  c.city,
  coalesce(c.state, 'MO'),
  c.zip,
  c.access_notes,
  true
from public.customers c
where not exists (
  select 1 from public.properties p where p.customer_id = c.id
);

-- Attach equipment/jobs to primary property when missing
update public.equipment e
set property_id = p.id
from public.properties p
where e.customer_id = p.customer_id
  and p.is_primary = true
  and e.property_id is null;

update public.jobs j
set property_id = p.id
from public.properties p
where j.customer_id = p.customer_id
  and p.is_primary = true
  and j.property_id is null;

alter table public.properties enable row level security;
drop policy if exists "Authenticated full access to properties" on public.properties;
create policy "Authenticated full access to properties" on public.properties
  for all to authenticated using (true) with check (true);
grant all on public.properties to postgres, anon, authenticated, service_role;

-- ========== 2. COMPANY SETTINGS ==========
create table if not exists public.company_settings (
  id int primary key default 1 check (id = 1),
  name text not null default 'EasyDispatch HVAC',
  legal_name text,
  phone text,
  email text,
  website text,
  address text,
  city text,
  state text default 'MO',
  zip text,
  license_number text,
  logo_url text,
  brand_color text default '#1a7af5',
  invoice_footer text default 'Thank you for your business. Payment is due upon receipt unless otherwise noted.',
  estimate_footer text default 'This estimate is valid for 30 days. Prices may change if site conditions differ.',
  sms_signature text default 'EasyDispatch HVAC',
  updated_at timestamptz default now()
);

insert into public.company_settings (id, name)
values (1, 'EasyDispatch HVAC')
on conflict (id) do nothing;

alter table public.company_settings enable row level security;
drop policy if exists "Authenticated full access to company_settings" on public.company_settings;
create policy "Authenticated full access to company_settings" on public.company_settings
  for all to authenticated using (true) with check (true);
grant all on public.company_settings to postgres, anon, authenticated, service_role;

-- ========== 3. APPOINTMENT CONFIRMATION ==========
alter table public.jobs add column if not exists confirmation_status text default 'unsent';
alter table public.jobs add column if not exists confirmation_token text;
alter table public.jobs add column if not exists confirmed_at timestamptz;
alter table public.jobs add column if not exists reschedule_note text;

create unique index if not exists jobs_confirmation_token_uidx
  on public.jobs (confirmation_token)
  where confirmation_token is not null;

-- ========== 4. EQUIPMENT WARRANTIES ==========
alter table public.equipment add column if not exists warranty_parts_expires date;
alter table public.equipment add column if not exists warranty_labor_expires date;
alter table public.equipment add column if not exists warranty_notes text;

-- ========== 5. SPECIAL-ORDER PARTS ==========
create table if not exists public.job_part_orders (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid references public.jobs(id) on delete cascade not null,
  description text not null,
  sku text,
  vendor text,
  qty numeric(10,2) default 1,
  unit_cost numeric(12,2) default 0,
  status text not null default 'needed'
    check (status in ('needed', 'ordered', 'received', 'installed', 'cancelled')),
  eta_date date,
  ordered_at timestamptz,
  received_at timestamptz,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists job_part_orders_job_idx on public.job_part_orders (job_id);

alter table public.job_part_orders enable row level security;
drop policy if exists "Authenticated full access to job_part_orders" on public.job_part_orders;
create policy "Authenticated full access to job_part_orders" on public.job_part_orders
  for all to authenticated using (true) with check (true);
grant all on public.job_part_orders to postgres, anon, authenticated, service_role;

-- ========== 6. TECH SKILLS ==========
alter table public.profiles add column if not exists skills text[] default '{}';
alter table public.profiles add column if not exists certifications text;
alter table public.jobs add column if not exists required_skills text[] default '{}';

-- ========== 9. MEMBERSHIP BILLING ==========
alter table public.service_agreements
  add column if not exists billing_interval text default 'monthly'
  check (billing_interval in ('monthly', 'quarterly', 'yearly', 'none'));
alter table public.service_agreements add column if not exists next_bill_date date;
alter table public.service_agreements add column if not exists last_billed_at timestamptz;
alter table public.service_agreements add column if not exists auto_bill boolean default false;

update public.service_agreements
set next_bill_date = coalesce(next_bill_date, next_due_date)
where next_bill_date is null;

-- ========== 10. GOOD / BETTER / BEST ESTIMATES ==========
alter table public.estimates add column if not exists package_id uuid;
alter table public.estimates add column if not exists option_label text
  check (option_label is null or option_label in ('Good', 'Better', 'Best'));
alter table public.estimates add column if not exists option_headline text;
alter table public.estimates add column if not exists is_recommended boolean default false;

create index if not exists estimates_package_idx on public.estimates (package_id);

-- Storage for company logos
insert into storage.buckets (id, name, public)
values ('company-assets', 'company-assets', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated upload company-assets" on storage.objects;
create policy "Authenticated upload company-assets" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'company-assets');

drop policy if exists "Public read company-assets" on storage.objects;
create policy "Public read company-assets" on storage.objects
  for select to public
  using (bucket_id = 'company-assets');
