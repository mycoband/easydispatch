-- Workflow depth: inventory reorder fields + equipment PM checklist
-- Safe to re-run.

alter table public.inventory_items
  add column if not exists vendor text,
  add column if not exists reorder_qty numeric(10,2),
  add column if not exists reorder_ordered_at timestamptz;

comment on column public.inventory_items.vendor is 'Preferred vendor for reorder / PO list';
comment on column public.inventory_items.reorder_qty is 'Suggested order qty when at/below min (null = compute)';
comment on column public.inventory_items.reorder_ordered_at is 'When last marked ordered from reorder list';

alter table public.equipment
  add column if not exists pm_checklist jsonb default '{}'::jsonb;

comment on column public.equipment.pm_checklist is 'Per-unit PM checklist state { itemId: { checked, at } }';

-- Customer account portal links (status, history, approve, pay)
alter table public.portal_tokens
  drop constraint if exists portal_tokens_purpose_check;

alter table public.portal_tokens
  add constraint portal_tokens_purpose_check
  check (purpose in ('estimate', 'invoice', 'customer'));
