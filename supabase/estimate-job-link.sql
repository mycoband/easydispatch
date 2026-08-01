-- Link estimates to existing jobs (run once in Supabase SQL editor)
-- Allows techs/office to build estimates on a job; converted_job_id remains "applied" history.

alter table public.estimates
  add column if not exists job_id uuid references public.jobs(id) on delete set null;

create index if not exists estimates_job_id_idx on public.estimates (job_id);

comment on column public.estimates.job_id is
  'Job this estimate was built for (may differ from converted_job_id until applied)';
