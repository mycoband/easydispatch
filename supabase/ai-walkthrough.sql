-- AI Job Walkthrough — free-form field capture → AI report.
-- Run once in Supabase SQL editor.
-- For video clips also run supabase/ai-walkthrough-video.sql (or the block below).

alter table public.jobs
  add column if not exists walkthrough jsonb default '{}'::jsonb;

comment on column public.jobs.walkthrough is
  'AI Job Walkthrough: { status, notes, findings, work_performed, recommendations, customer_summary, parts[], labor_*, totals, raw_ai, generated_at, saved_at }';

-- Allow walkthrough video on job_attachments (safe if already applied)
alter table public.job_attachments
  drop constraint if exists job_attachments_kind_check;

alter table public.job_attachments
  add constraint job_attachments_kind_check
  check (kind in ('photo', 'voice', 'note', 'video'));
