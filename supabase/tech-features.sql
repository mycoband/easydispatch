-- Run once in Supabase SQL Editor after office-features.sql
-- Tech field features: signatures, attachments, safety checklist

-- ========== JOB CLOSE-OUT / SIGNATURE ==========
alter table public.jobs add column if not exists signature_data text;
alter table public.jobs add column if not exists signature_name text;
alter table public.jobs add column if not exists signed_at timestamptz;
alter table public.jobs add column if not exists customer_approved_at timestamptz;
alter table public.jobs add column if not exists customer_approved_note text;
alter table public.jobs add column if not exists safety_checklist jsonb default '{}'::jsonb;

comment on column public.jobs.signature_data is 'Base64 PNG data URL of customer signature';
comment on column public.jobs.safety_checklist is 'JSON map of checklist item id -> { checked, at }';

-- ========== JOB ATTACHMENTS (photos / voice notes) ==========
create table if not exists public.job_attachments (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid references public.jobs(id) on delete cascade not null,
  kind text not null check (kind in ('photo', 'voice', 'note')),
  tag text default 'other', -- before, after, nameplate, voice, other
  url text,
  caption text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create index if not exists job_attachments_job_idx on public.job_attachments (job_id);

alter table public.job_attachments enable row level security;

drop policy if exists "Authenticated full access to job_attachments" on public.job_attachments;
create policy "Authenticated full access to job_attachments" on public.job_attachments
  for all to authenticated using (true) with check (true);

grant all on public.job_attachments to postgres, anon, authenticated, service_role;

-- ========== STORAGE: job-media bucket ==========
-- Create in Dashboard → Storage if insert fails, or run:
insert into storage.buckets (id, name, public)
values ('job-media', 'job-media', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated upload job-media" on storage.objects;
create policy "Authenticated upload job-media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'job-media');

drop policy if exists "Authenticated update job-media" on storage.objects;
create policy "Authenticated update job-media" on storage.objects
  for update to authenticated
  using (bucket_id = 'job-media');

drop policy if exists "Public read job-media" on storage.objects;
create policy "Public read job-media" on storage.objects
  for select to public
  using (bucket_id = 'job-media');
