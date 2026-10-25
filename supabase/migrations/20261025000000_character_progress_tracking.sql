-- Character progress tracking (see src/utils/charProgress.js and
-- src/utils/studyDays.js).
--
-- Must be applied BEFORE deploying the app version that uses it: that
-- version's pushCardProgress writes known_at/can_write_at, and every push
-- would fail (and pile up in the retry queue) against a table without
-- them.

-- When each card last became Known / Can Write, as millisecond epochs
-- (bigint, like last_reviewed). Null for cards that got there before this
-- column existed - the app treats those as "a while ago".
alter table public.card_progress
  add column if not exists known_at bigint,
  add column if not exists can_write_at bigint;

-- One row per user per local calendar day studied: how many reviews, and
-- how many of them were remembered. Behind "5 of 7 days" and "remembered
-- 88% of reviews".
create table if not exists public.study_days (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  reviews integer not null default 0 check (reviews >= 0),
  passed integer not null default 0 check (passed >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.study_days enable row level security;

create policy "read own study days" on public.study_days
  for select using (auth.uid() = user_id);
create policy "insert own study days" on public.study_days
  for insert with check (auth.uid() = user_id);
create policy "update own study days" on public.study_days
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Adds to a day's counts rather than overwriting them, so two devices
-- studying on the same day add up. Runs as the calling user, so the RLS
-- policies above still apply.
create or replace function public.add_study_activity(p_day date, p_reviews integer, p_passed integer)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.study_days (user_id, day, reviews, passed)
  values (auth.uid(), p_day, greatest(p_reviews, 0), greatest(p_passed, 0))
  on conflict (user_id, day) do update
    set reviews = public.study_days.reviews + excluded.reviews,
        passed = public.study_days.passed + excluded.passed,
        updated_at = now();
$$;

revoke execute on function public.add_study_activity(date, integer, integer) from public, anon;
grant execute on function public.add_study_activity(date, integer, integer) to authenticated;
