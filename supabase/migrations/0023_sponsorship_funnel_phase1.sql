-- Sponsorship Funnel — Phase 1 (program-wide, not marching-band-only)
-- Build spec: BandDirectorOS projects/sponsorship/build-spec.md (items A-data, B, D, E, G, K).
--
-- This migration is ADDITIVE and SAFE (every column/table guarded with if-not-exists).
-- It does three things:
--   1. Bridge the sponsorship `families` identity to the Family Portal identity, so the
--      sponsorship area can become portal-native (every band family is "in" automatically)
--      WITHOUT ripping out the existing PIN login (decision: bridge, not replace).
--   2. Add provenance + single-pool claim/reclaim lifecycle to the `businesses` lead model.
--   3. Add a `sponsor_gifts` ledger (separate from student `fee_payments` — the two-bucket
--      rule: student fees and charitable sponsorships are never co-mingled) plus the
--      public-listing view that drives auto-recognition on ashleybands.com/sponsors.
--
-- Nothing here turns anything on. The funnel ships DARK behind SPONSOR_FUNNEL_LIVE and
-- recognition sends behind SPONSOR_RECOGNITION_LIVE (see lib/sponsorFamily.js).

create extension if not exists "pgcrypto";

-- ============ 1. Bridge families -> portal identity (item A) ============
-- portal_person_id links a sponsorship family record to the logged-in portal guardian.
-- source distinguishes a record created by the legacy PIN signup from one auto-created
-- the first time a portal family opens the sponsorship section.

alter table families
  add column if not exists portal_person_id uuid references portal_people(id) on delete set null,
  add column if not exists portal_student_id uuid references portal_students(id) on delete set null,
  add column if not exists source text not null default 'pin'
    check (source in ('pin','portal'));

-- A portal person maps to at most one sponsorship family record.
create unique index if not exists families_portal_person_idx
  on families(portal_person_id) where portal_person_id is not null;

-- ============ 2. businesses: provenance + single-pool claim/reclaim (item B) ============
-- provenance: 'system-sourced' = the cold prospect DB (the 681); 'family-sourced' = a
--   business a family named. Drives cold-email rules and which leads can be browsed/claimed.
-- claim: a business is claimed by at most ONE family at a time (no double-pitch, no poaching).
--   claimed_at + reclaim_at drive the 1-week timer (item G). claim_contacted_at freezes the
--   timer once the student reports they made contact ("stays theirs").

alter table businesses
  add column if not exists provenance text not null default 'system-sourced'
    check (provenance in ('system-sourced','family-sourced')),
  add column if not exists claimed_by_family_id uuid references families(id) on delete set null,
  add column if not exists claimed_at timestamptz,
  add column if not exists reclaim_at timestamptz,
  add column if not exists claim_contacted_at timestamptz,
  add column if not exists reclaim_nudged_at timestamptz;

create index if not exists businesses_claimed_by_idx on businesses(claimed_by_family_id);
create index if not exists businesses_reclaim_idx on businesses(reclaim_at)
  where claimed_by_family_id is not null and claim_contacted_at is null;
create index if not exists businesses_provenance_idx on businesses(provenance);

-- ============ 3. prospects: contact mode + contacted timestamp (items C, G) ============
-- contact_mode: how the student is reaching the business — themselves ('self') or after the
--   program sends one warming email first ('warm_first'). lead_kind tags how the prospect
--   entered: a family's own add vs a claimed warmed lead from the pool.

alter table public.prospects
  add column if not exists contact_mode text
    check (contact_mode in ('self','warm_first') or contact_mode is null),
  add column if not exists lead_kind text not null default 'family_added'
    check (lead_kind in ('family_added','claimed_warm')),
  add column if not exists contacted_at timestamptz;

-- ============ 4. sponsor_gifts ledger (items D, E) ============
-- A confirmed business gift. SEPARATE from fee_payments on purpose (two-bucket model:
-- student fees vs charitable sponsorship — never co-mingled; different tax treatment).
-- All money in integer cents. fmv_cents = fair market value of any tangible benefits
-- (apparel, tickets, framed photo); deductible_cents = amount_cents - fmv_cents (IRS
-- quid-pro-quo). family_id / prospect_id attribute the gift to the bringing student for
-- the $2,000 dashboard total and the instrument-reveal photo (a gift can also be cold,
-- with no family).

create table if not exists sponsor_gifts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete set null,
  family_id uuid references families(id) on delete set null,
  prospect_id uuid references prospects(id) on delete set null,
  business_name text not null default '',     -- denormalized snapshot (survives business delete)
  amount_cents integer not null check (amount_cents > 0),
  method text not null default 'check'
    check (method in ('online','check','cash','other')),
  status text not null default 'pending'
    check (status in ('pending','confirmed','refunded','void')),
  tier text,
  payer_name text not null default '',
  payer_email text not null default '',
  fmv_cents integer not null default 0 check (fmv_cents >= 0),
  deductible_cents integer,
  -- our id, also sent to PayPal as invoice_id for reconciliation
  invoice_id text unique,
  paypal_order_id text not null default '',
  paypal_capture_id text not null default '',
  -- Lane A recognition bookkeeping
  receipt_number text,
  receipt_sent_at timestamptz,
  badge_sent_at timestamptz,
  listed_on_site boolean not null default false,
  recognition_status text not null default 'none'
    check (recognition_status in ('none','queued_dark','sent','failed')),
  recorded_by text not null default '',        -- 'business_online' for self-serve, else staff name
  received_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sponsor_gifts_business_idx on sponsor_gifts(business_id);
create index if not exists sponsor_gifts_family_idx on sponsor_gifts(family_id);
create index if not exists sponsor_gifts_status_idx on sponsor_gifts(status);
create index if not exists sponsor_gifts_order_idx on sponsor_gifts(paypal_order_id);

drop trigger if exists sponsor_gifts_updated_at on sponsor_gifts;
create trigger sponsor_gifts_updated_at
  before update on sponsor_gifts
  for each row execute function set_updated_at();

-- ============ 5. PayPal webhook idempotency for gifts ============
-- Reuse the existing paypal_webhook_events table from 0011 for dedupe; no new table.

-- ============ 6. Public sponsor listing view (item E.2 auto-publish) ============
-- The ONLY sponsor data the public /sponsors page reads: a confirmed gift that the booster
-- has cleared for listing. Names + tier + year only. No contacts, no amounts, no families.

create or replace view sponsor_public_listing as
select
  g.id as gift_id,
  coalesce(nullif(g.business_name, ''), b.name_display) as name_display,
  g.tier,
  g.confirmed_at,
  extract(year from coalesce(g.confirmed_at, g.created_at))::int as gift_year
from sponsor_gifts g
left join businesses b on b.id = g.business_id
where g.status = 'confirmed'
  and g.listed_on_site = true;

-- ============ 7. Program total view (confirmed sponsorship money) ============
-- Confirmed gift dollars, with a per-family rollup for the $2,000 dashboard goal.

create or replace view sponsor_family_totals as
select
  g.family_id,
  count(*) filter (where g.status = 'confirmed') as confirmed_gifts,
  coalesce(sum(g.amount_cents) filter (where g.status = 'confirmed'), 0)::bigint as confirmed_cents
from sponsor_gifts g
where g.family_id is not null
group by g.family_id;

-- ============ 8. RLS (item K) ============
-- Re-assert RLS on every sponsorship table. API routes use SUPABASE_SECRET_KEY (service
-- role, bypasses RLS) and enforce access server-side. The publishable key must never be
-- able to read business contacts or gift records directly around the app routes.
-- (enable row level security is idempotent — safe to re-run.)

alter table families enable row level security;
alter table businesses enable row level security;
alter table staff enable row level security;
alter table prospects enable row level security;
alter table business_outreach enable row level security;
alter table sponsor_gifts enable row level security;
