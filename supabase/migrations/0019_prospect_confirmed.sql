-- Reported vs. confirmed sponsorship money.
-- Families self-report a "yes" + committed amount in the tracker. That should not
-- count toward the program total until the sponsor lead has the signed form in hand.
-- This separates the two so the goal tracker reflects banked commitments, not hopes.
-- Additive + safe.

alter table public.prospects
  add column if not exists confirmed_by_lead boolean not null default false,
  add column if not exists confirmed_at timestamptz;

create index if not exists prospects_confirmed_idx on public.prospects(confirmed_by_lead);
