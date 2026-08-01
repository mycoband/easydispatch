-- Multi-tenant SaaS: companies, membership, billing columns, tenant RLS
-- Run AFTER schema.sql + office/tech/competitive/company-modules.sql

-- ---------------------------------------------------------------------------
-- Companies (paying HVAC shops)
-- ---------------------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  owner_user_id uuid references auth.users(id) on delete set null,
  plan text not null default 'trial'
    check (plan in ('trial', 'starter', 'pro', 'enterprise')),
  subscription_status text not null default 'trialing'
    check (subscription_status in (
      'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'unpaid', 'none'
    )),
  trial_ends_at timestamptz default (now() + interval '14 days'),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  billing_email text,
  seat_limit int default 10,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists companies_stripe_customer_idx
  on public.companies (stripe_customer_id);

-- Invite codes for joining an existing shop
alter table public.companies
  add column if not exists invite_code text unique;

update public.companies
set invite_code = upper(substr(replace(id::text, '-', ''), 1, 8))
where invite_code is null;

-- ---------------------------------------------------------------------------
-- Seed default company from existing singleton settings (idempotent)
-- ---------------------------------------------------------------------------
do $$
declare
  default_company uuid;
  settings_name text;
begin
  select id into default_company from public.companies order by created_at limit 1;
  if default_company is null then
    select coalesce(name, 'EasyDispatch HVAC') into settings_name
    from public.company_settings where id = 1;

    insert into public.companies (name, slug, plan, subscription_status, trial_ends_at)
    values (
      coalesce(settings_name, 'EasyDispatch HVAC'),
      'default',
      'pro',
      'active',
      now() + interval '365 days'
    )
    returning id into default_company;
  end if;

  -- profiles.company_id
  alter table public.profiles
    add column if not exists company_id uuid references public.companies(id) on delete set null;

  update public.profiles
  set company_id = default_company
  where company_id is null;

  -- Link company_settings to companies (keep id=1 row for backwards compat)
  alter table public.company_settings
    add column if not exists company_id uuid references public.companies(id) on delete cascade;

  -- Drop singleton check so additional shops can have settings rows
  alter table public.company_settings drop constraint if exists company_settings_id_check;

  update public.company_settings
  set company_id = default_company
  where id = 1 and company_id is null;

  create unique index if not exists company_settings_company_id_uidx
    on public.company_settings (company_id)
    where company_id is not null;

  -- Tenant columns on business tables
  alter table public.customers
    add column if not exists company_id uuid references public.companies(id) on delete cascade;
  alter table public.equipment
    add column if not exists company_id uuid references public.companies(id) on delete cascade;
  alter table public.jobs
    add column if not exists company_id uuid references public.companies(id) on delete cascade;
  alter table public.estimates
    add column if not exists company_id uuid references public.companies(id) on delete cascade;
  alter table public.inventory_items
    add column if not exists company_id uuid references public.companies(id) on delete cascade;
  alter table public.service_agreements
    add column if not exists company_id uuid references public.companies(id) on delete cascade;
  alter table public.messages
    add column if not exists company_id uuid references public.companies(id) on delete cascade;
  alter table public.tax_rates
    add column if not exists company_id uuid references public.companies(id) on delete cascade;
  alter table public.pricebook_items
    add column if not exists company_id uuid references public.companies(id) on delete cascade;
  alter table public.properties
    add column if not exists company_id uuid references public.companies(id) on delete cascade;
  alter table public.job_part_orders
    add column if not exists company_id uuid references public.companies(id) on delete cascade;
  alter table public.job_attachments
    add column if not exists company_id uuid references public.companies(id) on delete cascade;
  alter table public.portal_tokens
    add column if not exists company_id uuid references public.companies(id) on delete cascade;
  alter table public.line_items
    add column if not exists company_id uuid references public.companies(id) on delete cascade;

  -- Backfill from default company
  update public.customers set company_id = default_company where company_id is null;
  update public.equipment set company_id = default_company where company_id is null;
  update public.jobs set company_id = default_company where company_id is null;
  update public.estimates set company_id = default_company where company_id is null;
  update public.inventory_items set company_id = default_company where company_id is null;
  update public.service_agreements set company_id = default_company where company_id is null;
  update public.messages set company_id = default_company where company_id is null;
  update public.tax_rates set company_id = default_company where company_id is null;
  update public.pricebook_items set company_id = default_company where company_id is null;
  update public.properties set company_id = default_company where company_id is null;
  update public.job_part_orders set company_id = default_company where company_id is null;
  update public.job_attachments set company_id = default_company where company_id is null;
  update public.portal_tokens set company_id = default_company where company_id is null;
  update public.line_items set company_id = default_company where company_id is null;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.user_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid()
$$;

create or replace function public.set_row_company_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.company_id is null then
    new.company_id := public.user_company_id();
  end if;
  return new;
end;
$$;

-- Attach insert triggers (idempotent)
do $$
declare
  t text;
begin
  foreach t in array array[
    'customers','equipment','jobs','estimates','inventory_items',
    'service_agreements','messages','tax_rates','pricebook_items',
    'properties','job_part_orders','job_attachments','portal_tokens','line_items'
  ]
  loop
    execute format('drop trigger if exists set_company_id_trg on public.%I', t);
    execute format(
      'create trigger set_company_id_trg before insert on public.%I
       for each row execute function public.set_row_company_id()',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS: replace open policies with company isolation where possible
-- ---------------------------------------------------------------------------
alter table public.companies enable row level security;

drop policy if exists "Users see own company" on public.companies;
create policy "Users see own company" on public.companies
  for select to authenticated
  using (id = public.user_company_id() or owner_user_id = auth.uid());

drop policy if exists "Owners update own company" on public.companies;
create policy "Owners update own company" on public.companies
  for update to authenticated
  using (
    id = public.user_company_id()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'owner' and p.company_id = companies.id
    )
  );

grant select, update on public.companies to authenticated;
grant all on public.companies to service_role;

-- Helper to swap a table to tenant RLS
create or replace function public.apply_company_rls(table_name text)
returns void
language plpgsql
as $$
begin
  execute format('alter table public.%I enable row level security', table_name);
  execute format('drop policy if exists "Authenticated full access to %s" on public.%I', table_name, table_name);
  execute format('drop policy if exists "company_select" on public.%I', table_name);
  execute format('drop policy if exists "company_insert" on public.%I', table_name);
  execute format('drop policy if exists "company_update" on public.%I', table_name);
  execute format('drop policy if exists "company_delete" on public.%I', table_name);
  execute format(
    'create policy company_select on public.%I for select to authenticated using (company_id = public.user_company_id())',
    table_name
  );
  execute format(
    'create policy company_insert on public.%I for insert to authenticated with check (company_id = public.user_company_id() or company_id is null)',
    table_name
  );
  execute format(
    'create policy company_update on public.%I for update to authenticated using (company_id = public.user_company_id())',
    table_name
  );
  execute format(
    'create policy company_delete on public.%I for delete to authenticated using (company_id = public.user_company_id())',
    table_name
  );
end;
$$;

select public.apply_company_rls('customers');
select public.apply_company_rls('equipment');
select public.apply_company_rls('jobs');
select public.apply_company_rls('estimates');
select public.apply_company_rls('inventory_items');
select public.apply_company_rls('service_agreements');
select public.apply_company_rls('messages');
select public.apply_company_rls('pricebook_items');
select public.apply_company_rls('properties');
select public.apply_company_rls('job_part_orders');
select public.apply_company_rls('job_attachments');
select public.apply_company_rls('portal_tokens');
select public.apply_company_rls('line_items');

-- tax_rates: company rows + legacy null (shared) readable
alter table public.tax_rates enable row level security;
drop policy if exists "Authenticated full access to tax_rates" on public.tax_rates;
drop policy if exists "company_select" on public.tax_rates;
drop policy if exists "company_insert" on public.tax_rates;
drop policy if exists "company_update" on public.tax_rates;
drop policy if exists "company_delete" on public.tax_rates;
create policy company_select on public.tax_rates for select to authenticated
  using (company_id = public.user_company_id() or company_id is null);
create policy company_insert on public.tax_rates for insert to authenticated
  with check (company_id = public.user_company_id() or company_id is null);
create policy company_update on public.tax_rates for update to authenticated
  using (company_id = public.user_company_id());
create policy company_delete on public.tax_rates for delete to authenticated
  using (company_id = public.user_company_id());

-- company_settings by company
alter table public.company_settings enable row level security;
drop policy if exists "Authenticated full access to company_settings" on public.company_settings;
drop policy if exists "company_settings_select" on public.company_settings;
drop policy if exists "company_settings_upsert" on public.company_settings;
create policy company_settings_select on public.company_settings for select to authenticated
  using (company_id = public.user_company_id() or id = 1);
create policy company_settings_upsert on public.company_settings for all to authenticated
  using (company_id = public.user_company_id() or id = 1)
  with check (company_id = public.user_company_id() or id = 1);

-- profiles: users see teammates in same company
alter table public.profiles enable row level security;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "Authenticated full access to profiles" on public.profiles;
drop policy if exists "profiles_company_select" on public.profiles;
drop policy if exists "profiles_self_update" on public.profiles;
create policy profiles_company_select on public.profiles for select to authenticated
  using (id = auth.uid() or company_id = public.user_company_id());
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid());

grant usage on schema public to authenticated;
