-- Per-company feature modules (enable/disable categories)
-- Run once in Supabase SQL Editor after competitive-features.sql

alter table public.company_settings
  add column if not exists modules jsonb default '{}'::jsonb;

comment on column public.company_settings.modules is
  'JSON map of module_id -> boolean. Missing keys use app defaults (enabled).';

-- Ensure row exists
insert into public.company_settings (id, name, modules)
values (1, 'EasyDispatch HVAC', '{}'::jsonb)
on conflict (id) do nothing;
