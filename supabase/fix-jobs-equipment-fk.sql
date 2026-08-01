-- Optional: allow equipment delete without failing when jobs still reference it.
-- App wipe/import cleanup also nulls jobs.equipment_id before deleting customers.
-- Run once in Supabase SQL Editor if you want the DB to enforce this permanently.

alter table public.jobs
  drop constraint if exists jobs_equipment_id_fkey;

alter table public.jobs
  add constraint jobs_equipment_id_fkey
  foreign key (equipment_id)
  references public.equipment(id)
  on delete set null;
