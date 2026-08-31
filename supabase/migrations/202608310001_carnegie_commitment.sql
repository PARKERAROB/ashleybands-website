-- Carnegie Hall 2027 initial family intent and conditional-deposit workflow.
-- provenance: family submissions through the AshleyBands public or authenticated portal;
-- staff verbal entries and follow-up state through the audited Carnegie staff workspace.

create table if not exists public.carnegie_trip_submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.portal_students(id) on delete restrict,
  submitted_by_person_id uuid references public.portal_people(id) on delete set null,
  submitted_by_staff_id uuid references public.staff(id) on delete set null,
  source text not null check (source in ('public','portal','staff_verbal')),
  response text not null check (response in ('serious_yes','interested_limited','no')),
  maximum_family_amount_band text not null default ''
    check (maximum_family_amount_band in ('','500_or_less','501_1000','1001_1500','1501_1999')),
  help_options text[] not null default '{}'::text[],
  guardian_name text not null default '',
  guardian_email text not null default '',
  guardian_phone text not null default '',
  guardian_signature text not null default '',
  student_signature text not null default '',
  agreement_version text not null,
  terms_accepted boolean not null default false,
  signed_at timestamptz,
  submission_key text not null unique,
  supersedes_submission_id uuid references public.carnegie_trip_submissions(id) on delete set null,
  note text not null default '',
  ip_created text,
  user_agent_created text,
  created_at timestamptz not null default now()
);

comment on table public.carnegie_trip_submissions is
  'Append-only Carnegie 2027 family intent evidence. Financial charges and payments remain in fee_charges and fee_payments.';

create index if not exists carnegie_trip_submissions_student_idx
  on public.carnegie_trip_submissions(student_id, created_at desc);

create table if not exists public.carnegie_trip_staff_tracking (
  student_id uuid primary key references public.portal_students(id) on delete restrict,
  eligibility_status text not null default 'not_reviewed'
    check (eligibility_status in ('not_reviewed','preapproved','approved','needs_review','not_approved')),
  follow_up_status text not null default 'none'
    check (follow_up_status in ('none','login_help','contact_needed','complete')),
  staff_note text not null default '',
  updated_by_staff_id uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.carnegie_trip_staff_tracking is
  'Staff-owned eligibility and follow-up state for Carnegie 2027; never a financial ledger.';

create table if not exists public.carnegie_trip_refund_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.fee_payments(id) on delete restrict,
  requested_by_staff_id uuid not null references public.staff(id) on delete restrict,
  status text not null check (status in ('requested','completed','pending','failed')),
  paypal_refund_id text not null default '',
  error_summary text not null default '',
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (payment_id, status)
);

comment on table public.carnegie_trip_refund_events is
  'Operational evidence for real processor refunds of Carnegie conditional deposits.';

create unique index if not exists carnegie_active_deposit_charge_idx
  on public.fee_charges(student_id, category)
  where status = 'active' and category = 'carnegie_2027_conditional_deposit';

create unique index if not exists carnegie_open_or_paid_deposit_payment_idx
  on public.fee_payments(student_id, category)
  where status in ('pending','completed') and category = 'carnegie_2027_conditional_deposit';

insert into public.form_definitions (code, title, description, owner_label)
values (
  'carnegie-2027-initial-intent',
  'Carnegie Hall initial commitment',
  'Family intent, signatures, and the connected $50 conditional deposit for Carnegie Hall 2027.',
  'AshleyBands'
)
on conflict (code) do update set
  title = excluded.title,
  description = excluded.description,
  owner_label = excluded.owner_label,
  active = true;

insert into public.form_versions (definition_id, version, delivery_type, action_href, source_label, is_sensitive, effective_from)
select id, '2026-09-01-v1', 'portal', '/carnegie-2027/commit', 'AshleyBands Carnegie 2027 family intent', true, date '2026-09-01'
from public.form_definitions where code = 'carnegie-2027-initial-intent'
on conflict (definition_id, version) do update set
  delivery_type = excluded.delivery_type,
  action_href = excluded.action_href,
  source_label = excluded.source_label,
  is_sensitive = excluded.is_sensitive,
  effective_from = excluded.effective_from;

insert into public.form_requirements (
  definition_id, version_id, school_year, scope_type, scope_ref, starts_on, due_on, ends_on, source_label
)
select definition.id, version.id, '2026-2027', 'group', groups.id::text,
  date '2026-09-01', date '2026-09-04', date '2026-09-05', 'Current Carnegie-eligible ensemble roster'
from public.form_definitions definition
join public.form_versions version on version.definition_id = definition.id and version.version = '2026-09-01-v1'
join public.program_groups groups on groups.code in (
  'concert-band-2026-27', 'wind-ensemble-2026-27', 'percussion-ensemble-2026-27'
)
where definition.code = 'carnegie-2027-initial-intent'
on conflict (definition_id, school_year, scope_type, scope_ref) do update set
  version_id = excluded.version_id,
  starts_on = excluded.starts_on,
  due_on = excluded.due_on,
  ends_on = excluded.ends_on,
  active = true,
  source_label = excluded.source_label;

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
  p_route text
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
begin
  if p_source not in ('public','portal','staff_verbal') then raise exception 'invalid source'; end if;
  if p_response not in ('serious_yes','interested_limited','no') then raise exception 'invalid response'; end if;
  if p_agreement_version <> '2026-09-01-v1' then raise exception 'invalid agreement version'; end if;
  if nullif(btrim(p_submission_key), '') is null then raise exception 'submission key required'; end if;
  if p_source <> 'staff_verbal' and (
    not p_terms_accepted or nullif(btrim(p_guardian_signature), '') is null
    or nullif(btrim(p_student_signature), '') is null
  ) then raise exception 'signatures and acceptance required'; end if;
  if p_response = 'interested_limited' and p_maximum_family_amount_band not in ('500_or_less','501_1000','1001_1500','1501_1999') then
    raise exception 'maximum family amount required';
  end if;
  if not exists (select 1 from portal_students where id = p_student_id and status = 'active') then
    raise exception 'active student required';
  end if;

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
    maximum_family_amount_band, help_options, guardian_name, guardian_email, guardian_phone,
    guardian_signature, student_signature, agreement_version, terms_accepted, signed_at,
    submission_key, supersedes_submission_id, note, ip_created, user_agent_created
  ) values (
    p_student_id, p_submitted_by_person_id, p_submitted_by_staff_id, p_source, p_response,
    coalesce(p_maximum_family_amount_band, ''), coalesce(p_help_options, '{}'::text[]),
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

  if p_response = 'serious_yes' and v_charge_id is null then
    insert into fee_charges (
      student_id, category, label, amount_cents, status, source, kind, created_by, notes
    ) values (
      p_student_id, 'carnegie_2027_conditional_deposit', 'Carnegie Hall conditional deposit',
      5000, 'active', 'manual', 'fee',
      case when p_source = 'staff_verbal' then left(coalesce(p_actor_name, 'Staff verbal commitment'), 200) else 'family_commitment' end,
      'Connected to Carnegie Hall 2027 initial intent.'
    ) returning id into v_charge_id;
  elsif p_response <> 'serious_yes' and v_charge_id is not null and v_completed_cents = 0 then
    update fee_charges set status = 'void', notes = 'Voided after the latest Carnegie family response did not request the conditional deposit.'
      where id = v_charge_id;
    update fee_payments set status = 'failed', notes = 'Closed after the latest Carnegie family response did not request the conditional deposit.'
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
    jsonb_build_object('student_id', p_student_id, 'source', p_source, 'response', p_response, 'charge_id', v_charge_id),
    p_route
  );

  return jsonb_build_object('submissionId', v_submission_id, 'studentId', p_student_id, 'chargeId', v_charge_id);
end;
$$;

create or replace function public.settle_online_fee_refund_with_audit(
  p_payment_id uuid,
  p_actor_type text,
  p_actor_id text,
  p_actor_name text,
  p_route text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment fee_payments%rowtype;
begin
  if p_actor_type not in ('staff','system') then raise exception 'invalid refund actor'; end if;
  select * into v_payment from fee_payments where id = p_payment_id for update;
  if v_payment.id is null then raise exception 'payment not found'; end if;
  if v_payment.status = 'refunded' then return p_payment_id; end if;
  if v_payment.status <> 'completed' or v_payment.method <> 'paypal' then raise exception 'completed PayPal payment required'; end if;

  update fee_payments set status = 'refunded' where id = p_payment_id;
  if v_payment.category = 'carnegie_2027_conditional_deposit' then
    update fee_charges set status = 'void', notes = 'Voided after the conditional deposit was refunded.'
      where student_id = v_payment.student_id and category = v_payment.category and status = 'active';
  end if;
  insert into audit_log (actor_type, actor_id, actor_name, action, table_name, record_id, changes, route)
  values (
    p_actor_type, nullif(p_actor_id, ''), nullif(p_actor_name, ''), 'refund_online_payment',
    'fee_payments', p_payment_id::text,
    jsonb_build_object('student_id', v_payment.student_id, 'amount_cents', v_payment.amount_cents,
      'category', v_payment.category, 'status', jsonb_build_object('old', v_payment.status, 'new', 'refunded')),
    p_route
  );
  return p_payment_id;
end;
$$;

revoke all on table public.carnegie_trip_submissions from anon, authenticated;
revoke all on table public.carnegie_trip_staff_tracking from anon, authenticated;
revoke all on table public.carnegie_trip_refund_events from anon, authenticated;
grant all on table public.carnegie_trip_submissions to service_role;
grant all on table public.carnegie_trip_staff_tracking to service_role;
grant all on table public.carnegie_trip_refund_events to service_role;
alter table public.carnegie_trip_submissions enable row level security;
alter table public.carnegie_trip_staff_tracking enable row level security;
alter table public.carnegie_trip_refund_events enable row level security;

revoke all on function public.record_carnegie_trip_submission(uuid,text,text,text,text[],text,text,text,text,text,text,boolean,text,text,uuid,uuid,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.record_carnegie_trip_submission(uuid,text,text,text,text[],text,text,text,text,text,text,boolean,text,text,uuid,uuid,text,text,text,text,text,text) to service_role;
revoke all on function public.settle_online_fee_refund_with_audit(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.settle_online_fee_refund_with_audit(uuid,text,text,text,text) to service_role;

drop trigger if exists carnegie_trip_staff_tracking_updated_at on public.carnegie_trip_staff_tracking;
create trigger carnegie_trip_staff_tracking_updated_at before update on public.carnegie_trip_staff_tracking
  for each row execute function set_updated_at();

notify pgrst, 'reload schema';
