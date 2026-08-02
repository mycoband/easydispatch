-- Pick tickets: persist AI extract JSON on job attachment photos.
-- Run once in Supabase SQL editor after tech-features.sql.
-- Photos use job_attachments.tag = 'pick_ticket' (no new table).

alter table public.job_attachments
  add column if not exists extract_json jsonb;

comment on column public.job_attachments.extract_json is
  'Last AI extract for pick tickets / similar vision (JSON). Used when tag = pick_ticket.';

create index if not exists job_attachments_pick_ticket_idx
  on public.job_attachments (job_id)
  where tag = 'pick_ticket';
