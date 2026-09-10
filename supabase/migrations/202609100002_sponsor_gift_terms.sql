-- provenance: checkout_disclosed_terms; null retains original terms for pre-versioned Carnegie gifts.
-- No updates to existing gifts. Older deployed code may still insert null during rollout.
alter table public.sponsor_gifts add column gift_terms_version text
  check (gift_terms_version in ('carnegie-2027-v1', 'carnegie-2027-v2'));
comment on column public.sponsor_gifts.gift_terms_version is
  'Terms disclosed at checkout. Null on Carnegie gifts means original v1 terms. Other campaigns do not use this field.';
