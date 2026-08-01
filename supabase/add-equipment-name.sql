-- Equipment display name / label (e.g. "RTU 1", "Furnace 2")
-- Run once in Supabase SQL Editor

alter table public.equipment
  add column if not exists name text;

comment on column public.equipment.name is 'Unit label on the property, e.g. RTU 1, Furnace 2';
