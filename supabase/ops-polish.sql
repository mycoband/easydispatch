-- Ops polish: enable Realtime on jobs for live dispatch board.
-- Run once in Supabase SQL editor (safe to re-run).

do $$
begin
  alter publication supabase_realtime add table public.jobs;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'supabase_realtime publication missing — enable Realtime in Dashboard → Database → Replication';
end $$;

-- Helpful for UPDATE payloads
alter table public.jobs replica identity full;
