-- Sprint 1 security harden — run once in Supabase SQL editor.
-- 1) Block client self-updates of profiles.role / profiles.company_id
-- 2) Scope job-media authenticated writes to {job_uuid}/... paths
-- 3) AI rate-limit event log (app enforces window)
--
-- After apply: confirm Vercel env has CRON_SECRET set (crons now fail-closed).

-- ========== PROFILES: lock privileged columns ==========
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role / postgres may change role and company_id (provisioning, team admin).
  if coalesce(auth.role(), '') in ('service_role', 'postgres') then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.company_id is distinct from old.company_id then
    raise exception 'Cannot change role or company_id via client update'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_privileged on public.profiles;
create trigger profiles_protect_privileged
  before update on public.profiles
  for each row
  execute function public.protect_profile_privileged_columns();

-- ========== STORAGE: path-scoped job-media writes ==========
-- Keep public read; restrict authenticated insert/update to job-uuid folder prefix.
-- Service role (admin uploads, PM equipment paths) bypasses these policies.

drop policy if exists "Authenticated upload job-media" on storage.objects;
create policy "Authenticated upload job-media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'job-media'
    and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
  );

drop policy if exists "Authenticated update job-media" on storage.objects;
create policy "Authenticated update job-media" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'job-media'
    and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
  )
  with check (
    bucket_id = 'job-media'
    and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
  );

-- Public read unchanged (Sprint 2: private bucket + signed URLs)
drop policy if exists "Public read job-media" on storage.objects;
create policy "Public read job-media" on storage.objects
  for select to public
  using (bucket_id = 'job-media');

-- ========== AI rate limit events ==========
create table if not exists public.ai_rate_events (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  route text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_rate_events_user_created_idx
  on public.ai_rate_events (user_id, created_at desc);

alter table public.ai_rate_events enable row level security;

-- No client policies: only service role inserts/selects from the app.
drop policy if exists "ai_rate_events_no_client" on public.ai_rate_events;

grant all on public.ai_rate_events to service_role;
grant usage, select on sequence public.ai_rate_events_id_seq to service_role;
