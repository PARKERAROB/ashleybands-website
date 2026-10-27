-- Issue #237: Carnegie trip-share and adult-travel payments have their own accounts
-- (lib/carnegieTripAccount.js, lib/carnegieAdults.js) and no charge rows, so they must not
-- count toward the program-fee balance views. The $50 deposit keeps its charge and stays in.
-- provenance: view change only; no new person data.
create or replace view public.student_program_fee_summary
with (security_invoker = true) as
with fee_charges_only as (
  select student_id, coalesce(sum(amount_cents), 0)::bigint as charged_cents
  from public.fee_charges
  where status = 'active'
    and coalesce(kind, 'fee') = 'fee'
    and category not like 'marching_band%'
  group by student_id
), fee_payments_only as (
  select student_id, coalesce(sum(amount_cents), 0)::bigint as paid_cents
  from public.fee_payments
  where status = 'completed'
    and coalesce(is_sponsorship, false) = false
    and kind = 'fee'
    and category not in ('carnegie_2027_trip', 'carnegie_2027_adult')
  group by student_id
)
select s.id as student_id,
       coalesce(c.charged_cents, 0)::bigint as charged_cents,
       coalesce(p.paid_cents, 0)::bigint as paid_cents,
       (coalesce(c.charged_cents, 0) - coalesce(p.paid_cents, 0))::bigint as balance_cents
from public.portal_students s
left join fee_charges_only c on c.student_id = s.id
left join fee_payments_only p on p.student_id = s.id;

create or replace view public.student_fee_balances
with (security_invoker = true) as
with charged as (
  select student_id, coalesce(sum(amount_cents), 0)::bigint as charged_cents
  from public.fee_charges
  where status = 'active'
  group by student_id
), paid as (
  select student_id, coalesce(sum(amount_cents), 0)::bigint as paid_cents
  from public.fee_payments
  where status = 'completed'
    and category not in ('carnegie_2027_trip', 'carnegie_2027_adult')
  group by student_id
), ids as (
  select student_id from charged
  union
  select student_id from paid
)
select ids.student_id,
       coalesce(c.charged_cents, 0)::bigint as charged_cents,
       coalesce(p.paid_cents, 0)::bigint as paid_cents,
       (coalesce(c.charged_cents, 0) - coalesce(p.paid_cents, 0))::bigint as balance_cents
from ids
left join charged c on c.student_id = ids.student_id
left join paid p on p.student_id = ids.student_id;
