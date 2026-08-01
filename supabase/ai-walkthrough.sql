-- AI Job Walkthrough Phase 1 — free-form field capture → AI report (later phases).
-- Run once in Supabase SQL editor.

alter table public.jobs
  add column if not exists walkthrough jsonb default '{}'::jsonb;

comment on column public.jobs.walkthrough is
  'AI Job Walkthrough: { status, notes, findings, work_performed, recommendations, customer_summary, parts[], labor_*, totals, raw_ai, generated_at, saved_at }';
