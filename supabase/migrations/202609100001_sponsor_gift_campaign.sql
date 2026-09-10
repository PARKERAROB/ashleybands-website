-- provenance: donor_selected_campaign via public gift creation; existing gifts retain general purpose.
-- Apply before releasing the campaign checkout and staff read paths. No historical reclassification.
alter table public.sponsor_gifts
  add column campaign_code text not null default 'general'
    check (campaign_code in ('general', 'carnegie-2027')),
  add column gift_kind text not null default 'sponsorship'
    check (gift_kind in ('donation', 'sponsorship'));
comment on column public.sponsor_gifts.campaign_code is
  'Gift purpose selected at creation. Legacy gifts are general support; student attribution is separate.';
comment on column public.sponsor_gifts.gift_kind is
  'Donor-selected donation or business sponsorship; not permission to publish recognition.';
create index sponsor_gifts_campaign_status_idx on public.sponsor_gifts (campaign_code, status);
