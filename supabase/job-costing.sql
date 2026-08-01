-- Job costing: costs, wages, job P&L snapshot, company costing settings
-- Run once in Supabase SQL Editor (safe to re-run).

-- Pricebook cost + type
alter table public.pricebook_items
  add column if not exists unit_cost numeric(12,2) default 0,
  add column if not exists item_type text default 'other',
  add column if not exists target_margin_pct numeric(6,2);

comment on column public.pricebook_items.unit_cost is 'Your cost (COGS / labor burden input)';
comment on column public.pricebook_items.item_type is 'labor | parts | other';

-- Line item cost
alter table public.line_items
  add column if not exists unit_cost numeric(12,2) default 0,
  add column if not exists item_type text default 'other',
  add column if not exists pricebook_item_id uuid;

comment on column public.line_items.unit_cost is 'Unit cost used for job P&L';

-- Tech economics
alter table public.profiles
  add column if not exists hourly_cost numeric(12,2),
  add column if not exists burden_pct numeric(6,2);

comment on column public.profiles.hourly_cost is 'Fully loaded or base wage $/hour for job labor cost';
comment on column public.profiles.burden_pct is 'Override company burden % (null = use company default)';

-- Company costing defaults
alter table public.company_settings
  add column if not exists costing jsonb default '{}'::jsonb;

comment on column public.company_settings.costing is 'target_margin_pct, default_burden_pct, overhead_per_hour, tech_see_costs, weekly_digest_enabled, weekly_digest_email, etc.';

-- Job P&L snapshot (recomputed on line/hours changes)
alter table public.jobs
  add column if not exists cost_materials numeric(12,2) default 0,
  add column if not exists cost_labor numeric(12,2) default 0,
  add column if not exists cost_overhead numeric(12,2) default 0,
  add column if not exists cost_total numeric(12,2) default 0,
  add column if not exists gross_profit numeric(12,2) default 0,
  add column if not exists margin_pct numeric(8,2),
  add column if not exists costing_updated_at timestamptz;

create index if not exists jobs_margin_pct_idx on public.jobs (margin_pct);
create index if not exists jobs_gross_profit_idx on public.jobs (gross_profit);
