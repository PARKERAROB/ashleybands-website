-- Campaign-scoped student credit (#103).
--
-- Marching band per-student funding and sponsorship views count only general-campaign gifts.
-- A Carnegie gift credited to a student is record-keeping only: it counts in the band's Carnegie
-- total and in the student's Carnegie credit, never in a marching figure, balance or amount owed.
-- No rows change. Column lists and security_invoker are preserved; only the gift filters narrow.
-- provenance: derived views over sponsor_gifts; campaign_code is donor-selected or staff-recorded.

create or replace view public.student_campaign_summary
with (security_invoker = true) as
with goals as (
  select student_id, coalesce(sum(amount_cents), 0)::bigint as goal_cents
  from public.fee_charges
  where status = 'active' and (kind = 'funding_goal' or category like 'marching_band%')
  group by student_id
), contributions as (
  select student_id,
         coalesce(sum(amount_cents) filter (where coalesce(is_sponsorship, false) = false), 0)::bigint as family_contribution_cents,
         coalesce(sum(amount_cents) filter (where coalesce(is_sponsorship, false) = true), 0)::bigint as legacy_sponsorship_credit_cents
  from public.fee_payments
  where status = 'completed' and kind = 'funding_goal'
  group by student_id
), gifts as (
  select portal_student_id as student_id, coalesce(sum(amount_cents), 0)::bigint as confirmed_gift_cents
  from public.sponsor_gifts
  where status = 'confirmed' and portal_student_id is not null and campaign_code = 'general'
  group by portal_student_id
)
select s.id as student_id,
       coalesce(g.goal_cents, 0)::bigint as goal_cents,
       coalesce(c.family_contribution_cents, 0)::bigint as family_contribution_cents,
       coalesce(x.confirmed_gift_cents, 0)::bigint as confirmed_gift_cents,
       coalesce(c.legacy_sponsorship_credit_cents, 0)::bigint as legacy_sponsorship_credit_cents,
       (coalesce(c.family_contribution_cents, 0) + coalesce(x.confirmed_gift_cents, 0))::bigint as raised_cents,
       greatest(coalesce(g.goal_cents, 0) - coalesce(c.family_contribution_cents, 0) - coalesce(x.confirmed_gift_cents, 0), 0)::bigint as remaining_cents
from public.portal_students s
left join goals g on g.student_id = s.id
left join contributions c on c.student_id = s.id
left join gifts x on x.student_id = s.id;

create or replace view public.sponsor_student_totals
with (security_invoker = true) as
select
  g.portal_student_id,
  count(*) filter (where g.status = 'confirmed') as confirmed_gifts,
  coalesce(sum(g.amount_cents) filter (where g.status = 'confirmed'), 0)::bigint as confirmed_cents
from public.sponsor_gifts g
where g.portal_student_id is not null and g.campaign_code = 'general'
group by g.portal_student_id;

create or replace view public.sponsor_family_totals
with (security_invoker = true) as
select
  g.family_id,
  count(*) filter (where g.status = 'confirmed') as confirmed_gifts,
  coalesce(sum(g.amount_cents) filter (where g.status = 'confirmed'), 0)::bigint as confirmed_cents
from public.sponsor_gifts g
where g.family_id is not null and g.campaign_code = 'general'
group by g.family_id;

-- Staff-only per-student Carnegie credit. Not a balance and not money a student can use.
create or replace view public.carnegie_student_credit_totals
with (security_invoker = true) as
select
  g.portal_student_id as student_id,
  count(*)::bigint as confirmed_gifts,
  coalesce(sum(g.amount_cents), 0)::bigint as confirmed_cents
from public.sponsor_gifts g
where g.status = 'confirmed' and g.campaign_code = 'carnegie-2027' and g.portal_student_id is not null
group by g.portal_student_id;

comment on view public.carnegie_student_credit_totals is
  'Record-keeping only (#103): confirmed Carnegie gifts credited to a student. Also counted in the Carnegie campaign total. Not a balance; never reduces an amount owed. Staff server reads only.';

revoke all privileges on table public.student_campaign_summary from anon, authenticated;
revoke all privileges on table public.sponsor_student_totals from anon, authenticated;
revoke all privileges on table public.sponsor_family_totals from anon, authenticated;
revoke all privileges on table public.carnegie_student_credit_totals from anon, authenticated;
