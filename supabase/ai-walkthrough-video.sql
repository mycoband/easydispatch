-- AI Job Walkthrough — allow video clips on job_attachments.
-- Run once in Supabase SQL editor (after tech-features.sql / ai-walkthrough.sql).

alter table public.job_attachments
  drop constraint if exists job_attachments_kind_check;

alter table public.job_attachments
  add constraint job_attachments_kind_check
  check (kind in ('photo', 'voice', 'note', 'video'));

comment on column public.job_attachments.kind is
  'photo | voice | note | video (walkthrough clips use tag walkthrough)';
