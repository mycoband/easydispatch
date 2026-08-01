-- Per-company role permissions (what techs / office staff can do)
-- Run after company-modules.sql / multi-tenant-saas.sql

alter table public.company_settings
  add column if not exists role_permissions jsonb default '{}'::jsonb;

comment on column public.company_settings.role_permissions is
  'Per-role capability toggles: { technician: {...}, dispatcher: {...}, office: {...} }';
