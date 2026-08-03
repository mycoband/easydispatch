-- AI Job Walkthrough — allow video clips on job_attachments + larger uploads.
-- Run once in Supabase SQL editor (after tech-features.sql / ai-walkthrough.sql).

alter table public.job_attachments
  drop constraint if exists job_attachments_kind_check;

alter table public.job_attachments
  add constraint job_attachments_kind_check
  check (kind in ('photo', 'voice', 'note', 'video'));

comment on column public.job_attachments.kind is
  'photo | voice | note | video (walkthrough clips use tag walkthrough)';

-- Phone walkthrough clips often exceed the default 50MB storage limit.
-- App allows up to 80MB; uploads go browser → Supabase (not through Vercel).
update storage.buckets
set file_size_limit = 83886080
where id = 'job-media';
