-- Run once in Supabase SQL Editor if sign-in loops / profile is missing.
-- Safe to re-run.

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

-- Repair signup trigger (validates role; won't fail on bad metadata)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  chosen_role text;
begin
  chosen_role := coalesce(new.raw_user_meta_data->>'role', 'dispatcher');
  if chosen_role not in ('owner', 'dispatcher', 'technician', 'office') then
    chosen_role := 'dispatcher';
  end if;

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    chosen_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Backfill profiles for any auth users that never got a row
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
