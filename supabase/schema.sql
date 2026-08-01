-- EasyDispatch Production Schema
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ========== PROFILES (extends Supabase auth.users) ==========
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  role text not null default 'technician' check (role in ('owner', 'dispatcher', 'technician', 'office')),
  phone text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ========== CUSTOMERS / PROPERTIES ==========
create table public.customers (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid, -- for multi-tenant later
  name text not null,
  address text,
  city text,
  state text default 'MO',
  zip text,
  phone text,
  email text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index customers_name_idx on public.customers (name);

-- ========== EQUIPMENT ==========
create table public.equipment (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references public.customers(id) on delete cascade not null,
  name text, -- unit label e.g. "RTU 1", "Furnace 2"
  equipment_type text, -- RTU, Condenser, Furnace, etc.
  manufacturer text,
  model text,
  serial_number text,
  capacity text,
  electrical text,
  refrigerant text,
  filter_size text,   -- e.g. 16x25x1
  filter_qty integer, -- how many filters
  notes text,
  photo_url text, -- Supabase Storage URL
  install_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index equipment_customer_idx on public.equipment (customer_id);

-- ========== JOBS ==========
create table public.jobs (
  id uuid primary key default uuid_generate_v4(),
  job_number text unique,
  customer_id uuid references public.customers(id),
  customer_name text, -- denormalized for speed
  equipment_id uuid references public.equipment(id),
  job_type text,
  priority text default 'Medium' check (priority in ('Low', 'Medium', 'High', 'Emergency')),
  status text default 'New' check (status in ('New', 'Scheduled', 'In Progress', 'Completed', 'Cancelled')),
  assigned_to uuid references public.profiles(id),
  assigned_to_name text,
  diagnosis text,
  est_hours numeric(5,2),
  actual_hours numeric(5,2),
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  -- Time tracking: Drive Start → Arrive / Start Work → Clock Out
  drive_started_at timestamptz,
  check_in_at timestamptz,   -- Arrive / Start Work
  check_out_at timestamptz,  -- Clock Out
  check_in_lat numeric,
  check_in_lng numeric,
  tax_rate_id text,
  tax_rate numeric(6,5) default 0,
  subtotal numeric(12,2) default 0,
  tax_amount numeric(12,2) default 0,
  total numeric(12,2) default 0,
  invoice_status text default 'Not Sent' check (invoice_status in ('Not Sent', 'Sent')),
  invoice_sent_at timestamptz,
  payment_status text default 'Unpaid' check (payment_status in ('Unpaid', 'Partial', 'Paid', 'Refunded')),
  payment_method text,
  stripe_payment_id text,
  stripe_payment_link text,
  notes text,              -- customer-facing / general
  internal_notes text,     -- office + tech only; shown on dispatch cards
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index jobs_customer_idx on public.jobs (customer_id);
create index jobs_status_idx on public.jobs (status);
create index jobs_scheduled_idx on public.jobs (scheduled_start);
create index jobs_assigned_idx on public.jobs (assigned_to);

-- ========== LINE ITEMS (shared by jobs & estimates) ==========
create table public.line_items (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid references public.jobs(id) on delete cascade,
  estimate_id uuid, -- will reference estimates
  description text not null,
  qty numeric(10,2) default 1,
  unit_price numeric(12,2) default 0,
  taxable boolean default true,
  inventory_item_id uuid,
  sort_order int default 0,
  created_at timestamptz default now()
);

create index line_items_job_idx on public.line_items (job_id);

-- ========== ESTIMATES ==========
create table public.estimates (
  id uuid primary key default uuid_generate_v4(),
  estimate_number text unique,
  customer_id uuid references public.customers(id),
  customer_name text,
  description text,
  status text default 'Draft' check (status in ('Draft', 'Sent', 'Approved', 'Rejected', 'Expired')),
  tax_rate_id text,
  tax_rate numeric(6,5) default 0,
  subtotal numeric(12,2) default 0,
  tax_amount numeric(12,2) default 0,
  total numeric(12,2) default 0,
  valid_until date,
  converted_job_id uuid references public.jobs(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add foreign key for line_items.estimate_id
alter table public.line_items
  add constraint line_items_estimate_id_fkey
  foreign key (estimate_id) references public.estimates(id) on delete cascade;

-- ========== INVENTORY ==========
create table public.inventory_items (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  sku text,
  qty_on_hand numeric(10,2) default 0,
  min_qty numeric(10,2) default 0,
  cost numeric(12,2) default 0,
  sell_price numeric(12,2),
  location text, -- which truck / warehouse
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ========== SERVICE AGREEMENTS ==========
create table public.service_agreements (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references public.customers(id) not null,
  customer_name text,
  plan_name text not null,
  visits_per_year int default 4,
  monthly_amount numeric(12,2) default 0,
  next_due_date date,
  status text default 'Active' check (status in ('Active', 'Paused', 'Cancelled')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ========== MESSAGES (SMS / Email log) ==========
create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid references public.jobs(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  channel text check (channel in ('sms', 'email')),
  direction text check (direction in ('outbound', 'inbound')),
  to_address text,
  from_address text,
  body text,
  status text,
  provider_id text, -- Twilio SID etc.
  created_at timestamptz default now()
);

-- ========== TAX RATES (KC Metro) ==========
create table public.tax_rates (
  id text primary key,
  name text not null,
  rate numeric(6,5) not null,
  region text
);

insert into public.tax_rates (id, name, rate, region) values
  ('kcmo-jackson', 'Kansas City, MO (Jackson Co)', 0.09975, 'MO'),
  ('jackson-other', 'Jackson County, MO (other)', 0.08975, 'MO'),
  ('clay', 'Clay County, MO', 0.08725, 'MO'),
  ('platte', 'Platte County, MO', 0.08725, 'MO'),
  ('cass', 'Cass County, MO', 0.08225, 'MO'),
  ('johnson-ks', 'Johnson County, KS', 0.0935, 'KS'),
  ('wyandotte', 'Wyandotte County, KS', 0.09725, 'KS'),
  ('none', 'No Tax / Exempt', 0.0, null);

-- ========== STORAGE BUCKET for equipment photos ==========
insert into storage.buckets (id, name, public)
values ('equipment-photos', 'equipment-photos', true)
on conflict (id) do nothing;

create policy "Public read equipment photos"
  on storage.objects for select
  using (bucket_id = 'equipment-photos');

create policy "Authenticated upload equipment photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'equipment-photos');

create policy "Authenticated update equipment photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'equipment-photos');

create policy "Authenticated delete equipment photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'equipment-photos');

-- ========== GRANTS (required for API access) ==========
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on all tables in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;

-- ========== ROW LEVEL SECURITY (basic) ==========
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.equipment enable row level security;
alter table public.jobs enable row level security;
alter table public.line_items enable row level security;
alter table public.estimates enable row level security;
alter table public.inventory_items enable row level security;
alter table public.service_agreements enable row level security;
alter table public.messages enable row level security;
alter table public.tax_rates enable row level security;

-- Simple policies (tighten later)
create policy "Authenticated users can read profiles" on public.profiles
  for select to authenticated using (true);

create policy "Users can update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id);

create policy "Users can insert own profile" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

create policy "Authenticated full access to customers" on public.customers
  for all to authenticated using (true) with check (true);

create policy "Authenticated full access to equipment" on public.equipment
  for all to authenticated using (true) with check (true);

create policy "Authenticated full access to jobs" on public.jobs
  for all to authenticated using (true) with check (true);

create policy "Authenticated full access to line_items" on public.line_items
  for all to authenticated using (true) with check (true);

create policy "Authenticated full access to estimates" on public.estimates
  for all to authenticated using (true) with check (true);

create policy "Authenticated full access to inventory" on public.inventory_items
  for all to authenticated using (true) with check (true);

create policy "Authenticated full access to agreements" on public.service_agreements
  for all to authenticated using (true) with check (true);

create policy "Authenticated full access to messages" on public.messages
  for all to authenticated using (true) with check (true);

create policy "Authenticated read tax rates" on public.tax_rates
  for select to authenticated using (true);

-- ========== HELPER: auto-create profile on signup ==========
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  chosen_role text;
begin
  chosen_role := coalesce(new.raw_user_meta_data->>'role', 'dispatcher');
  if chosen_role not in ('owner', 'dispatcher', 'technician', 'office') then
    chosen_role := 'dispatcher';
  end if;

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    chosen_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
