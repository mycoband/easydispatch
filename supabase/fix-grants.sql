-- Fix: "permission denied for table profiles"
-- Run this entire file once in Supabase SQL Editor.

grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on all tables in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;
grant all on all routines in schema public to postgres, anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables to postgres, anon, authenticated, service_role;

alter default privileges in schema public
  grant all on sequences to postgres, anon, authenticated, service_role;

-- Ensure profile insert policy exists
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

-- Backfill any missing profiles
insert into public.profiles (id, full_name, role)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  case
    when u.raw_user_meta_data->>'role' in ('owner', 'dispatcher', 'technician', 'office')
      then u.raw_user_meta_data->>'role'
    else 'dispatcher'
  end
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
