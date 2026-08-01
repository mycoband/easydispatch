-- Differentiation: assign-tech location, review ask after paid+complete
-- Run once in Supabase SQL editor.

-- Tech last known GPS (updated on Drive / Arrive)
alter table public.profiles
  add column if not exists last_lat double precision,
  add column if not exists last_lng double precision,
  add column if not exists last_location_at timestamptz;

-- Google / review link for post-job ask (email)
alter table public.company_settings
  add column if not exists google_review_url text;

-- Idempotent review ask
alter table public.jobs
  add column if not exists review_asked_at timestamptz;
