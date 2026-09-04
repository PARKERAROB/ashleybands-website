-- Carnegie family-intent v3 restores the $50 conditional-deposit choice for every yes response.
-- Existing v1 and v2 submissions remain append-only and keep their original charge behavior.
-- provenance: deposit_choice is supplied by a family or recorded by staff from a family response.

alter table public.carnegie_trip_submissions
  add column if not exists deposit_choice text not null default '';

alter table public.carnegie_trip_submissions
  drop constraint if exists carnegie_trip_submissions_deposit_choice_check;

alter table public.carnegie_trip_submissions
  add constraint carnegie_trip_submissions_deposit_choice_check
  check (deposit_choice in ('', 'pay_now', 'cannot_pay_now'));

create or replace function public.record_carnegie_trip_submission(
  p_student_id uuid,
  p_source text,
  p_response text,
  p_maximum_family_amount_band text,
  p_help_options text[],
  p_guardian_name text,
  p_guardian_email text,
  p_guardian_phone text,
  p_guardian_signature text,
  p_student_signature text,
  p_agreement_version text,
  p_terms_accepted boolean,
  p_submission_key text,
  p_note text,
  p_submitted_by_person_id uuid,
  p_submitted_by_staff_id uuid,
  p_actor_type text,
  p_actor_id text,
  p_actor_name text,
  p_ip_created text,
  p_user_agent_created text,
  p_route text,
  p_deposit_choice text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing carnegie_trip_submissions%rowtype;
  v_previous_id uuid;
  v_submission_id uuid;
  v_charge_id uuid;
  v_completed_cents integer := 0;
  v_ensemble text := '';
  v_eligibility text := 'not_reviewed';
  v_deposit_choice text := coalesce(p_deposit_choice, '');
  v_deposit_requested boolean := false;
begin
  if p_source not in ('public','portal','staff_verbal') then raise exception 'invalid source'; end if;
  if p_response not in ('serious_yes','interested_limited','no') then raise exception 'invalid response'; end if;
  if p_agreement_version not in ('2026-09-01-v1','2026-09-03-v2','2026-09-03-v3') then raise exception 'invalid agreement version'; end if;
  if nullif(btrim(p_submission_key), '') is null then raise exception 'submission key required'; end if;
  if p_source <> 'staff_verbal' and (
    not p_terms_accepted or nullif(btrim(p_guardian_signature), '') is null
    or nullif(btrim(p_student_signature), '') is null
  ) then raise exception 'signatures and acceptance required'; end if;
  if p_response = 'interested_limited' and (
    (p_agreement_version = '2026-09-01-v1' and p_maximum_family_amount_band not in ('500_or_less','501_1000','1001_1500','1501_1999'))
    or
    (p_agreement_version in ('2026-09-03-v2','2026-09-03-v3') and p_maximum_family_amount_band not in ('full_assistance_required','up_to_500','501_1000','1001_1500','1501_1999'))
  ) then
    raise exception 'maximum family amount required';
  end if;
  if p_agreement_version = '2026-09-03-v3' and p_response <> 'no'
    and v_deposit_choice not in ('pay_now','cannot_pay_now') then
    raise exception 'deposit choice required';
  end if;
  if p_agreement_version = '2026-09-03-v3' and p_response = 'no' and v_deposit_choice <> '' then
    raise exception 'deposit choice does not apply to no response';
  end if;
  if p_agreement_version <> '2026-09-03-v3' and v_deposit_choice <> '' then
    raise exception 'deposit choice not available for earlier agreement';
  end if;
  if not exists (select 1 from portal_students where id = p_student_id and status = 'active') then
    raise exception 'active student required';
  end if;

  v_deposit_requested := case
    when p_agreement_version = '2026-09-03-v3' then p_response <> 'no' and v_deposit_choice = 'pay_now'
    else p_response = 'serious_yes'
  end;

  select * into v_existing from carnegie_trip_submissions where submission_key = p_submission_key;
  if v_existing.id is not null then
    select id into v_charge_id from fee_charges
      where student_id = v_existing.student_id and category = 'carnegie_2027_conditional_deposit' and status = 'active'
      order by created_at desc limit 1;
    return jsonb_build_object('submissionId', v_existing.id, 'studentId', v_existing.student_id, 'chargeId', v_charge_id);
  end if;

  select id into v_previous_id from carnegie_trip_submissions
    where student_id = p_student_id order by created_at desc, id desc limit 1;

  insert into carnegie_trip_submissions (
    student_id, submitted_by_person_id, submitted_by_staff_id, source, response,
    maximum_family_amount_band, deposit_choice, help_options, guardian_name, guardian_email, guardian_phone,
    guardian_signature, student_signature, agreement_version, terms_accepted, signed_at,
    submission_key, supersedes_submission_id, note, ip_created, user_agent_created
  ) values (
    p_student_id, p_submitted_by_person_id, p_submitted_by_staff_id, p_source, p_response,
    coalesce(p_maximum_family_amount_band, ''), v_deposit_choice, coalesce(p_help_options, '{}'::text[]),
    left(coalesce(p_guardian_name, ''), 200), left(lower(coalesce(p_guardian_email, '')), 320),
    left(coalesce(p_guardian_phone, ''), 80), left(coalesce(p_guardian_signature, ''), 200),
    left(coalesce(p_student_signature, ''), 200), p_agreement_version, p_terms_accepted,
    case when p_source = 'staff_verbal' then null else now() end,
    btrim(p_submission_key), v_previous_id, left(coalesce(p_note, ''), 1000),
    nullif(left(coalesce(p_ip_created, ''), 200), ''), nullif(left(coalesce(p_user_agent_created, ''), 500), '')
  ) returning id into v_submission_id;

  select coalesce(sum(amount_cents), 0)::integer into v_completed_cents
    from fee_payments where student_id = p_student_id
      and category = 'carnegie_2027_conditional_deposit' and kind = 'fee' and status = 'completed';
  select id into v_charge_id from fee_charges
    where student_id = p_student_id and category = 'carnegie_2027_conditional_deposit' and status = 'active'
    order by created_at desc limit 1;

  if v_deposit_requested and v_charge_id is null then
    insert into fee_charges (
      student_id, category, label, amount_cents, status, source, kind, created_by, notes
    ) values (
      p_student_id, 'carnegie_2027_conditional_deposit', 'Carnegie Hall conditional deposit',
      5000, 'active', 'manual', 'fee',
      case when p_source = 'staff_verbal' then left(coalesce(p_actor_name, 'Staff verbal commitment'), 200) else 'family_commitment' end,
      'Connected to Carnegie Hall 2027 initial intent and family deposit choice.'
    ) returning id into v_charge_id;
  elsif not v_deposit_requested and v_charge_id is not null and v_completed_cents = 0 then
    update fee_charges set status = 'void', notes = 'Voided after the latest Carnegie family response did not request payment of the conditional deposit at this time.'
      where id = v_charge_id;
    update fee_payments set status = 'failed', notes = 'Closed after the latest Carnegie family response did not request payment of the conditional deposit at this time.'
      where student_id = p_student_id and category = 'carnegie_2027_conditional_deposit' and status = 'pending';
    v_charge_id := null;
  end if;

  select coalesce(ensemble_2026, '') into v_ensemble from portal_students where id = p_student_id;
  v_eligibility := case
    when lower(v_ensemble) like '%wind ensemble%' then 'preapproved'
    when lower(v_ensemble) like '%concert band%' then 'needs_review'
    when lower(v_ensemble) like '%percussion ensemble%' then 'needs_review'
    else 'not_reviewed'
  end;

  insert into carnegie_trip_staff_tracking (
    student_id, eligibility_status, follow_up_status, updated_by_staff_id
  ) values (
    p_student_id, v_eligibility,
    case when p_source = 'staff_verbal' then 'login_help' else 'complete' end,
    p_submitted_by_staff_id
  )
  on conflict (student_id) do update set
    follow_up_status = case when p_source = 'staff_verbal' then 'login_help' else 'complete' end,
    updated_by_staff_id = coalesce(p_submitted_by_staff_id, carnegie_trip_staff_tracking.updated_by_staff_id),
    updated_at = now();

  insert into audit_log (actor_type, actor_id, actor_name, action, table_name, record_id, changes, route)
  values (
    p_actor_type, nullif(p_actor_id, ''), nullif(p_actor_name, ''), 'submit_carnegie_intent',
    'carnegie_trip_submissions', v_submission_id::text,
    jsonb_build_object(
      'student_id', p_student_id,
      'source', p_source,
      'response', p_response,
      'maximum_family_amount_band', coalesce(p_maximum_family_amount_band, ''),
      'deposit_choice', v_deposit_choice,
      'agreement_version', p_agreement_version,
      'charge_id', v_charge_id
    ),
    p_route
  );

  return jsonb_build_object('submissionId', v_submission_id, 'studentId', p_student_id, 'chargeId', v_charge_id);
end;
$$;

revoke all on function public.record_carnegie_trip_submission(uuid,text,text,text,text[],text,text,text,text,text,text,boolean,text,text,uuid,uuid,text,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.record_carnegie_trip_submission(uuid,text,text,text,text[],text,text,text,text,text,text,boolean,text,text,uuid,uuid,text,text,text,text,text,text,text) to service_role;
