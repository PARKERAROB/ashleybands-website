-- Ensure public views evaluate permissions and RLS as the querying role rather
-- than inheriting the privileges of the view owner.

alter view if exists public.prospect_dedup
  set (security_invoker = true);

alter view if exists public.business_outreach_rollup
  set (security_invoker = true);

alter view if exists public.portal_mirror_counts
  set (security_invoker = true);

alter view if exists public.student_fee_balances
  set (security_invoker = true);

alter view if exists public.business_touchpoints
  set (security_invoker = true);

alter view if exists public.sponsor_public_listing
  set (security_invoker = true);

alter view if exists public.sponsor_family_totals
  set (security_invoker = true);

alter view if exists public.portal_student_family_touch
  set (security_invoker = true);

alter view if exists public.portal_person_family_touch
  set (security_invoker = true);
