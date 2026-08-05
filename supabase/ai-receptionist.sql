-- AI receptionist (SMS + VoIP intake) — run once in Supabase SQL Editor
-- Idempotent where possible.

-- Job intake metadata
alter table public.jobs
  add column if not exists intake_source text
    check (intake_source is null or intake_source in ('ai_sms', 'ai_voice', 'manual'));

alter table public.jobs
  add column if not exists intake_summary text;

alter table public.jobs
  add column if not exists intake_transcript text;

alter table public.jobs
  add column if not exists intake_external_id text;

create index if not exists jobs_intake_source_idx
  on public.jobs (company_id, intake_source)
  where intake_source is not null;

create index if not exists jobs_unscheduled_intake_idx
  on public.jobs (company_id, created_at desc)
  where intake_source is not null
    and scheduled_start is null
    and status not in ('Cancelled', 'Completed');

-- Per-company receptionist settings (greeting, escalate number, Twilio DID)
alter table public.company_settings
  add column if not exists receptionist jsonb not null default '{}'::jsonb;

-- SMS multi-turn sessions
create table if not exists public.intake_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  channel text not null check (channel in ('sms', 'voice')),
  external_id text,
  from_phone text not null,
  status text not null default 'open'
    check (status in ('open', 'completed', 'abandoned')),
  messages jsonb not null default '[]'::jsonb,
  job_id uuid references public.jobs (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists intake_sessions_open_phone_idx
  on public.intake_sessions (company_id, from_phone, status)
  where status = 'open';

-- Audit / dashboard log
create table if not exists public.intake_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  channel text not null check (channel in ('sms', 'voice')),
  from_phone text,
  event_type text not null,
  job_id uuid references public.jobs (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists intake_events_company_created_idx
  on public.intake_events (company_id, created_at desc);

alter table public.intake_sessions enable row level security;
alter table public.intake_events enable row level security;

-- Office can read their tenant rows (service role used for webhooks)
drop policy if exists intake_sessions_select on public.intake_sessions;
create policy intake_sessions_select on public.intake_sessions
  for select using (
    company_id in (
      select company_id from public.profiles where id = auth.uid()
    )
  );

drop policy if exists intake_events_select on public.intake_events;
create policy intake_events_select on public.intake_events
  for select using (
    company_id in (
      select company_id from public.profiles where id = auth.uid()
    )
  );
