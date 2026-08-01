-- Add air filter size + quantity to equipment
-- Run once in Supabase SQL Editor (safe if columns already exist)

alter table public.equipment
  add column if not exists filter_size text,
  add column if not exists filter_qty integer;

comment on column public.equipment.filter_size is 'Air filter size, e.g. 16x25x1';
comment on column public.equipment.filter_qty is 'Number of filters this unit uses';
