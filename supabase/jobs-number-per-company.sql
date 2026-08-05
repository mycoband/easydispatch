-- Allow each company to use #1, #2, … without colliding globally.
-- Safe to re-run.

alter table public.jobs drop constraint if exists jobs_job_number_key;

drop index if exists jobs_job_number_key;

create unique index if not exists jobs_company_job_number_uidx
  on public.jobs (company_id, job_number)
  where job_number is not null;
