-- Allow fee_charges.source = 'signup' so marching-band charges created from the
-- signup flow (auto-on-submit + admin backfill) are distinguishable in the record.

alter table public.fee_charges
  drop constraint if exists fee_charges_source_check;

alter table public.fee_charges
  add constraint fee_charges_source_check
  check (source in ('manual','bulk','signup'));
