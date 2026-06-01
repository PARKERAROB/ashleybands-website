-- Payment/gift hygiene: capture hard fields that were being stuffed into notes.
-- payer_name  = who the money is from (check writer, sponsor business)
-- check_number = for checks
-- is_sponsorship = sponsorship is a SOURCE, independent of method (a sponsor can
--   pay by check/cash/paypal). Method stays the payment mechanism. Notes is for
--   soft context only. Additive + safe; existing rows default to non-sponsorship.

alter table public.fee_payments
  add column if not exists payer_name text not null default '',
  add column if not exists check_number text not null default '',
  add column if not exists is_sponsorship boolean not null default false;

-- Backfill: rows previously recorded with method='sponsorship' are sponsorships.
update public.fee_payments set is_sponsorship = true where method = 'sponsorship';
