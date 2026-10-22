-- #227: music notes show what the Boosters received for a student, after PayPal's fee.
-- paypal_fee_cents is PayPal's fee on an online gift, in cents.
-- provenance: PayPal capture seller_receivable_breakdown.paypal_fee, written by the capture
-- route and the PayPal webhook; older gifts backfilled once from PayPal by
-- scripts/backfill-sponsor-gift-fees.mjs. Null for check, cash and staff-recorded gifts (no fee).
-- Table access is unchanged: RLS on, no anon/authenticated privileges (service role only).

alter table public.sponsor_gifts
  add column if not exists paypal_fee_cents integer;

alter table public.sponsor_gifts
  drop constraint if exists sponsor_gifts_paypal_fee_cents_range;
alter table public.sponsor_gifts
  add constraint sponsor_gifts_paypal_fee_cents_range
  check (paypal_fee_cents is null or (paypal_fee_cents >= 0 and paypal_fee_cents <= amount_cents));
