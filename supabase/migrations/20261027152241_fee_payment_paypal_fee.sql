-- Issue #237: PayPal's fee on each online family payment, so Carnegie trip and adult
-- accounts credit what actually reached the Boosters (Rob, 2026-10-27: online payers may
-- cover the fee; if they don't, a small amount still shows as owed).
-- provenance: copied from PayPal's capture record (seller_receivable_breakdown.paypal_fee)
-- by /api/billing/capture-order, or backfilled by staff from the same PayPal record.
alter table public.fee_payments
  add column paypal_fee_cents integer check (paypal_fee_cents >= 0);
