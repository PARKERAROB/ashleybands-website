-- Charge "kind": separates real fees from collective funding goals so each shows the
-- right language. 'fee' = a real charge the family owes (e.g. spring trip $300):
-- charged / balance / pay. 'funding_goal' = a shared per-student target we raise
-- together (marching band season): goal / raised / remaining, not an individual bill.
-- Additive + safe; existing rows default to 'fee', marching-band charges backfilled.

alter table public.fee_charges
  add column if not exists kind text not null default 'fee'
  check (kind in ('fee','funding_goal'));

update public.fee_charges set kind = 'funding_goal' where category like 'marching_band%';
