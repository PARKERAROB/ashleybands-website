-- Issue #212: holiday raffle prize offers from the public /raffle form.
-- provenance: each row is one donor's own submission on ashleybands.com/raffle (source = 'raffle_form').
-- Private: no browser-role access. Writes go through /api/raffle/offer with the service role;
-- staff read through /api/admin/raffle-prizes. Offers are never shown on the public page.
create table public.raffle_prize_offers (
  id uuid primary key default gen_random_uuid(),
  donor_name text not null check (char_length(donor_name) between 1 and 200),
  business_name text not null default '' check (char_length(business_name) <= 200),
  contact text not null check (char_length(contact) between 3 and 200),
  prize_description text not null check (char_length(prize_description) between 1 and 2000),
  estimated_value text not null check (char_length(estimated_value) between 1 and 50),
  source text not null default 'raffle_form' check (source in ('raffle_form', 'staff')),
  created_at timestamptz not null default now()
);

create index raffle_prize_offers_created on public.raffle_prize_offers (created_at desc);

alter table public.raffle_prize_offers enable row level security;
revoke all privileges on table public.raffle_prize_offers from anon, authenticated;
grant all on table public.raffle_prize_offers to service_role;

comment on table public.raffle_prize_offers is
  'Source: donor submission on the public /raffle form (#212). Staff/service read only.';
