-- Business outreach prospect database — Phase A of business-prospect-list project
-- Extends the existing `businesses` table from migration 0001 with fields needed to
-- track prospect acquisition, enrichment, cold-outreach, and willingness opt-in.

alter table businesses
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists zip text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists website text,
  add column if not exists contact_person text,
  add column if not exists contact_title text,
  add column if not exists zone text check (zone in ('carolina-beach','mid-corridor','north-17th','out-of-area') or zone is null),
  add column if not exists source text,
  add column if not exists outreach_status text not null default 'untested'
    check (outreach_status in ('untested','asked','willing','declined','silent','already-sponsor','skip')),
  add column if not exists prior_sponsor boolean not null default false,
  add column if not exists enriched_at timestamptz,
  add column if not exists last_outreach_at timestamptz,
  add column if not exists willing_at timestamptz,
  add column if not exists declined_at timestamptz;

create index if not exists businesses_outreach_status_idx on businesses(outreach_status);
create index if not exists businesses_zone_idx on businesses(zone);
create index if not exists businesses_zip_idx on businesses(zip);

-- ============ Outreach event log ============
-- One row per cold-outreach send. Lets us track sends, see what bounced, see
-- what got a click-yes, audit per-campaign.

create table if not exists business_outreach (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  campaign text not null,                          -- e.g. '2026-2027-cold-willingness'
  sent_at timestamptz not null default now(),
  sent_to_email text not null,                     -- email used (audit trail if it changes later)
  sent_by_staff_id uuid references staff(id),
  gmail_message_id text,                           -- Gmail message id for audit
  click_token text unique,                         -- signed token used in click-yes URL
  click_yes_at timestamptz,
  click_yes_ip text,
  reply_received_at timestamptz,                   -- if a manual reply landed
  reply_classification text check (reply_classification in ('yes','no','question','other') or reply_classification is null),
  notes text
);

create index if not exists business_outreach_business_idx on business_outreach(business_id);
create index if not exists business_outreach_campaign_idx on business_outreach(campaign);
create index if not exists business_outreach_token_idx on business_outreach(click_token);

-- ============ Helper view: outreach rollup per business ============

create or replace view business_outreach_rollup as
select
  b.id as business_id,
  b.name_display,
  b.outreach_status,
  b.zone,
  b.email,
  count(o.id) as total_sends,
  max(o.sent_at) as last_sent_at,
  bool_or(o.click_yes_at is not null) as ever_clicked_yes,
  max(o.click_yes_at) as last_click_yes_at
from businesses b
left join business_outreach o on o.business_id = b.id
group by b.id, b.name_display, b.outreach_status, b.zone, b.email;

-- RLS already enabled on businesses from 0001. Enable on business_outreach too.
alter table business_outreach enable row level security;
