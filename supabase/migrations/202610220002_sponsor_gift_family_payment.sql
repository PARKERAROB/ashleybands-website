-- #228: a family's own payment toward one student's Carnegie trip, made from the student's music
-- notes link. Not a charitable gift: receipted as a payment with no tax-deductible wording.
-- provenance: gift_kind is chosen by the payer on the public give form; family_payment is allowed
-- only for campaign_code carnegie-2027 with a credited student (enforced in lib/sponsorGifts.js).
-- Table access is unchanged: RLS on, no anon/authenticated privileges (service role only).

alter table public.sponsor_gifts
  drop constraint if exists sponsor_gifts_gift_kind_check;
alter table public.sponsor_gifts
  add constraint sponsor_gifts_gift_kind_check
  check (gift_kind in ('donation', 'sponsorship', 'family_payment'));
