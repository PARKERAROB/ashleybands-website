-- Connected operations: normalized assets, actionable form requirements, and
-- finance read models that keep fees, campaign contributions, and gifts apart.

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  asset_type text not null check (asset_type in ('instrument','locker','lock','tuner','music','uniform','equipment')),
  asset_tag text not null default '',
  display_name text not null,
  lifecycle_status text not null default 'active'
    check (lifecycle_status in ('active','inactive','retired','missing')),
  operational_status text not null default 'unverified',
  condition_summary text not null default '',
  location text not null default '',
  source_system text not null,
  source_key text not null,
  source_hash text not null default '',
  last_verified_at timestamptz,
  source_updated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_system, source_key)
);

create unique index if not exists assets_asset_tag_unique
  on public.assets (asset_tag) where asset_tag <> '';
create index if not exists assets_type_status_idx
  on public.assets (asset_type, lifecycle_status, operational_status);

create table if not exists public.asset_instruments (
  asset_id uuid primary key references public.assets(id) on delete cascade,
  instrument_type text not null default '',
  brand text not null default '',
  model text not null default '',
  model_markings text not null default '',
  serial_number text not null default '',
  serial_location text not null default '',
  finish text not null default '',
  key_pitch text not null default '',
  level text not null default '',
  play_status text not null default '',
  repair_needed text not null default '',
  repair_priority text not null default '',
  visible_issues text not null default ''
);

create table if not exists public.asset_locks (
  asset_id uuid primary key references public.assets(id) on delete cascade,
  serial_number text not null default '',
  master_key text not null default '',
  confidence text not null default '',
  inventoried boolean,
  notes text not null default ''
);

-- Lock combinations are deliberately isolated from the general asset record.
-- No ordinary asset read model or endpoint selects from this table.
create table if not exists public.asset_lock_secrets (
  asset_id uuid primary key references public.asset_locks(asset_id) on delete cascade,
  combination text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.asset_assignments (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete restrict,
  student_id uuid references public.portal_students(id) on delete restrict,
  program_group_id uuid references public.program_groups(id) on delete restrict,
  holder_label text not null default '',
  starts_at timestamptz,
  ends_at timestamptz,
  assignment_status text not null default 'current'
    check (assignment_status in ('current','provisional','returned','cancelled')),
  source_system text not null,
  source_ref text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(student_id, program_group_id) <= 1)
);

create unique index if not exists asset_assignments_one_open_idx
  on public.asset_assignments (asset_id)
  where ends_at is null and assignment_status in ('current','provisional');
create index if not exists asset_assignments_student_open_idx
  on public.asset_assignments (student_id)
  where ends_at is null and assignment_status in ('current','provisional');

create table if not exists public.asset_relationships (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete restrict,
  related_asset_id uuid not null references public.assets(id) on delete restrict,
  relationship_type text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  source_system text not null,
  created_at timestamptz not null default now(),
  check (asset_id <> related_asset_id)
);

create table if not exists public.asset_events (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete restrict,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  actor_staff_id uuid references public.staff(id) on delete set null,
  source_system text not null,
  source_ref text not null default '',
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.asset_import_runs (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  source_hash text not null,
  mode text not null check (mode in ('check','apply')),
  status text not null check (status in ('running','complete','failed')),
  source_rows integer not null default 0,
  matched_rows integer not null default 0,
  issue_rows integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  summary jsonb not null default '{}'::jsonb
);

create table if not exists public.asset_import_issues (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null references public.asset_import_runs(id) on delete cascade,
  source_key text not null,
  issue_type text not null,
  summary text not null,
  candidates jsonb not null default '[]'::jsonb,
  resolved_at timestamptz,
  resolved_by_staff_id uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.instrument_inventory
  add column if not exists asset_id text not null default '',
  add column if not exists locker text not null default '',
  add column if not exists location text not null default '',
  add column if not exists repair_needed text not null default '',
  add column if not exists repair_priority text not null default '',
  add column if not exists canonical_asset_id uuid references public.assets(id) on delete set null,
  add column if not exists canonical_asset_linked_at timestamptz,
  add column if not exists canonical_asset_linked_by_staff_id uuid references public.staff(id) on delete set null;
create index if not exists instrument_inventory_asset_id_idx
  on public.instrument_inventory(asset_id);
create index if not exists instrument_inventory_canonical_asset_idx
  on public.instrument_inventory(canonical_asset_id);

alter table public.staff drop constraint if exists staff_role_check;
alter table public.staff add constraint staff_role_check
  check (role in ('director','sponsor_lead','program_staff'));

alter table public.fee_payments add column if not exists kind text not null default 'fee'
  check (kind in ('fee','funding_goal'));
update public.fee_payments set kind = 'funding_goal'
where category like 'marching_band%' or is_sponsorship = true;

create table if not exists public.form_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text not null default '',
  owner_label text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.form_versions (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null references public.form_definitions(id) on delete restrict,
  version text not null,
  delivery_type text not null
    check (delivery_type in ('portal','external','paper','staff_record')),
  action_href text not null default '',
  source_label text not null,
  is_sensitive boolean not null default false,
  effective_from date,
  effective_to date,
  created_at timestamptz not null default now(),
  unique (definition_id, version)
);

create table if not exists public.form_requirements (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null references public.form_definitions(id) on delete restrict,
  version_id uuid not null references public.form_versions(id) on delete restrict,
  school_year text not null,
  scope_type text not null
    check (scope_type in ('all_active','student','group','instrument_request')),
  scope_ref text not null default '',
  starts_on date,
  due_on date,
  ends_on date,
  active boolean not null default true,
  source_label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (definition_id, school_year, scope_type, scope_ref)
);

create table if not exists public.student_form_requirements (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.form_requirements(id) on delete restrict,
  student_id uuid not null references public.portal_students(id) on delete restrict,
  state text not null default 'not_started'
    check (state in ('not_started','submitted','needs_review','needs_correction','complete','waived','not_required','reopened')),
  completion_mode text not null
    check (completion_mode in ('portal','external','paper','staff_record')),
  source_ref text not null default '',
  next_action text not null default '',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  completed_at timestamptz,
  waived_at timestamptz,
  updated_by_staff_id uuid references public.staff(id) on delete set null,
  note_summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requirement_id, student_id)
);

create table if not exists public.form_submission_references (
  id uuid primary key default gen_random_uuid(),
  student_requirement_id uuid not null references public.student_form_requirements(id) on delete restrict,
  reference_type text not null check (reference_type in ('portal_record','external_reference','paper_receipt','staff_record')),
  source_table text not null default '',
  source_record_id text not null default '',
  received_at timestamptz,
  received_by_staff_id uuid references public.staff(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.form_requirement_events (
  id uuid primary key default gen_random_uuid(),
  student_requirement_id uuid not null references public.student_form_requirements(id) on delete restrict,
  from_state text,
  to_state text not null,
  actor_staff_id uuid references public.staff(id) on delete set null,
  reason text not null default '',
  occurred_at timestamptz not null default now()
);

insert into public.form_definitions (code, title, description, owner_label)
values
  ('career-onboarding', 'Career onboarding', 'The one-time connected student and family onboarding record.', 'AshleyBands'),
  ('county-instrument-agreement', 'County instrument responsibility agreement', 'Required when a student requests a school instrument.', 'AshleyBands')
on conflict (code) do update set
  title = excluded.title,
  description = excluded.description,
  owner_label = excluded.owner_label,
  active = true;

insert into public.form_versions (definition_id, version, delivery_type, action_href, source_label, is_sensitive)
select id, 'career-onboarding-v1', 'portal', '/portal/onboarding', 'AshleyBands connected onboarding', false
from public.form_definitions where code = 'career-onboarding'
on conflict (definition_id, version) do update set
  delivery_type = excluded.delivery_type,
  action_href = excluded.action_href,
  source_label = excluded.source_label;

insert into public.form_versions (definition_id, version, delivery_type, action_href, source_label, is_sensitive)
select id, '2026-2027', 'portal', '/portal/band-ready/forms', 'AshleyBands instrument request', false
from public.form_definitions where code = 'county-instrument-agreement'
on conflict (definition_id, version) do update set
  delivery_type = excluded.delivery_type,
  action_href = excluded.action_href,
  source_label = excluded.source_label;

insert into public.form_requirements (
  definition_id, version_id, school_year, scope_type, scope_ref, starts_on, source_label
)
select definition.id, version.id, '2026-2027', 'all_active', '', date '2026-07-01', 'AshleyBands connected onboarding'
from public.form_definitions definition
join public.form_versions version on version.definition_id = definition.id and version.version = 'career-onboarding-v1'
where definition.code = 'career-onboarding'
on conflict (definition_id, school_year, scope_type, scope_ref) do update set
  version_id = excluded.version_id,
  active = true,
  source_label = excluded.source_label;

insert into public.form_requirements (
  definition_id, version_id, school_year, scope_type, scope_ref, starts_on, source_label
)
select definition.id, version.id, '2026-2027', 'instrument_request', '', date '2026-07-01', 'AshleyBands instrument request'
from public.form_definitions definition
join public.form_versions version on version.definition_id = definition.id and version.version = '2026-2027'
where definition.code = 'county-instrument-agreement'
on conflict (definition_id, school_year, scope_type, scope_ref) do update set
  version_id = excluded.version_id,
  active = true,
  source_label = excluded.source_label;

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
  group by student_id
)
select s.id as student_id,
       coalesce(c.charged_cents, 0)::bigint as charged_cents,
       coalesce(p.paid_cents, 0)::bigint as paid_cents,
       (coalesce(c.charged_cents, 0) - coalesce(p.paid_cents, 0))::bigint as balance_cents
from public.portal_students s
left join fee_charges_only c on c.student_id = s.id
left join fee_payments_only p on p.student_id = s.id;

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
  where status = 'confirmed' and portal_student_id is not null
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

create or replace function public.set_student_form_requirement_state(
  p_requirement_id uuid,
  p_student_id uuid,
  p_state text,
  p_completion_mode text,
  p_next_action text,
  p_note_summary text,
  p_actor_staff_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_previous text;
  v_now timestamptz := now();
  v_scope_type text;
  v_scope_ref text;
  v_school_year text;
  v_delivery_type text;
  v_applicable boolean := false;
begin
  if p_state not in ('not_started','submitted','needs_review','needs_correction','complete','waived','not_required','reopened') then
    raise exception 'invalid form state';
  end if;
  if p_completion_mode not in ('portal','external','paper','staff_record') then
    raise exception 'invalid completion mode';
  end if;
  if not exists (select 1 from staff where id = p_actor_staff_id) then
    raise exception 'staff actor required';
  end if;
  if not exists (select 1 from portal_students where id = p_student_id and status = 'active') then
    raise exception 'active student required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_requirement_id::text || ':' || p_student_id::text, 0));
  select requirement.scope_type, requirement.scope_ref, requirement.school_year, version.delivery_type
    into v_scope_type, v_scope_ref, v_school_year, v_delivery_type
  from form_requirements requirement
  join form_versions version on version.id = requirement.version_id
  where requirement.id = p_requirement_id
    and requirement.active
    and (requirement.starts_on is null or requirement.starts_on <= current_date)
    and (requirement.ends_on is null or requirement.ends_on >= current_date);
  if v_scope_type is null then raise exception 'active requirement not found'; end if;
  if v_delivery_type = 'portal' then raise exception 'portal workflow owns this status'; end if;

  v_applicable := case v_scope_type
    when 'all_active' then true
    when 'student' then v_scope_ref = p_student_id::text
    when 'group' then exists (
      select 1 from program_memberships
      where student_id = p_student_id and group_id::text = v_scope_ref and ends_on is null
    )
    when 'instrument_request' then exists (
      select 1 from portal_student_music_profiles
      where student_id = p_student_id and instrument_access = 'school'
    ) or exists (
      select 1 from portal_instrument_requests
      where student_id = p_student_id and (v_school_year = '' or school_year = v_school_year)
    )
    else false
  end;
  if not v_applicable then raise exception 'requirement does not apply to this student'; end if;

  select id, state into v_id, v_previous
  from student_form_requirements
  where requirement_id = p_requirement_id and student_id = p_student_id
  for update;

  if v_id is null then
    insert into student_form_requirements (
      requirement_id, student_id, state, completion_mode, next_action,
      note_summary, submitted_at, reviewed_at, completed_at, waived_at,
      updated_by_staff_id
    ) values (
      p_requirement_id, p_student_id, p_state, p_completion_mode,
      coalesce(p_next_action, ''), coalesce(p_note_summary, ''),
      case when p_state = 'submitted' then v_now else null end,
      case when p_state in ('needs_review','needs_correction') then v_now else null end,
      case when p_state = 'complete' then v_now else null end,
      case when p_state in ('waived','not_required') then v_now else null end,
      p_actor_staff_id
    ) returning id into v_id;
  else
    update student_form_requirements set
      state = p_state,
      completion_mode = p_completion_mode,
      next_action = coalesce(p_next_action, ''),
      note_summary = coalesce(p_note_summary, ''),
      submitted_at = case when p_state = 'submitted' then coalesce(submitted_at, v_now) else submitted_at end,
      reviewed_at = case when p_state in ('needs_review','needs_correction') then v_now else null end,
      completed_at = case when p_state = 'complete' then v_now else null end,
      waived_at = case when p_state in ('waived','not_required') then v_now else null end,
      updated_by_staff_id = p_actor_staff_id,
      updated_at = v_now
    where id = v_id;
  end if;

  insert into form_requirement_events (
    student_requirement_id, from_state, to_state, actor_staff_id, reason
  ) values (
    v_id, v_previous, p_state, p_actor_staff_id, coalesce(p_note_summary, '')
  );
  return v_id;
end;
$$;

revoke all on function public.set_student_form_requirement_state(uuid,uuid,text,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.set_student_form_requirement_state(uuid,uuid,text,text,text,text,uuid) to service_role;

create or replace function public.assign_requested_instrument(
  p_asset_id uuid,
  p_student_id uuid,
  p_request_id uuid,
  p_actor_person_id uuid,
  p_actor_staff_id uuid,
  p_source text,
  p_condition text,
  p_notes text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment_id uuid;
  v_asset_name text;
begin
  if num_nonnulls(p_actor_person_id, p_actor_staff_id) <> 1 then
    raise exception 'exactly one assignment actor is required';
  end if;
  if p_actor_staff_id is not null
    and not exists (select 1 from staff where id = p_actor_staff_id) then
    raise exception 'staff actor not found';
  end if;
  if p_actor_person_id is not null and not exists (
    select 1
    from portal_student_people link
    join portal_people person on person.id = link.person_id
    where link.person_id = p_actor_person_id
      and link.student_id = p_student_id
      and link.relationship_status = 'trusted'
      and (
        (person.person_type = 'student' and link.assurance_level = 'high')
        or (person.person_type = 'guardian' and link.assurance_level in ('medium','high'))
      )
  ) then raise exception 'trusted assignment actor not found'; end if;
  if not exists (select 1 from portal_students where id = p_student_id and status = 'active') then
    raise exception 'active student required';
  end if;
  if not exists (
    select 1 from portal_instrument_requests
    where id = p_request_id and student_id = p_student_id and status = 'submitted'
  ) then raise exception 'instrument request is not available'; end if;
  select display_name into v_asset_name from assets
  where id = p_asset_id and asset_type = 'instrument' and lifecycle_status = 'active'
  for update;
  if v_asset_name is null then raise exception 'instrument asset not found'; end if;
  if exists (
    select 1 from asset_assignments
    where asset_id = p_asset_id and ends_at is null and assignment_status in ('current','provisional')
  ) then raise exception 'instrument already assigned'; end if;

  insert into asset_assignments (
    asset_id, student_id, starts_at, assignment_status, source_system, source_ref, notes
  ) values (
    p_asset_id, p_student_id, now(),
    case when p_source = 'staff_assignment' then 'current' else 'provisional' end,
    coalesce(p_source, 'portal_student_issue'),
    p_request_id::text, coalesce(p_notes, '')
  ) returning id into v_assignment_id;

  update portal_instrument_requests set status = 'assigned', updated_at = now()
  where id = p_request_id;

  insert into asset_events (asset_id, event_type, actor_staff_id, source_system, source_ref, summary, details)
  values (
    p_asset_id, 'assignment_started', p_actor_staff_id, coalesce(p_source, 'portal_student_issue'),
    p_request_id::text,
    case when p_source = 'staff_assignment'
      then 'Staff-confirmed student assignment recorded'
      else 'Provisional student assignment recorded'
    end,
    jsonb_build_object('assignment_id', v_assignment_id, 'student_id', p_student_id,
      'actor_person_id', p_actor_person_id, 'condition', coalesce(p_condition, ''))
  );
  return v_assignment_id;
end;
$$;

revoke all on function public.assign_requested_instrument(uuid,uuid,uuid,uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.assign_requested_instrument(uuid,uuid,uuid,uuid,uuid,text,text,text) to service_role;

-- An apply run has one publish boundary. The importer prepares an exact-match
-- plan, then this function commits the assets, protected secrets, provisional
-- assignments, review issues, and completed run together. Any exception rolls
-- back the whole apply while leaving history from earlier runs untouched.
create or replace function public.apply_asset_import_transaction(
  p_run_id uuid,
  p_assets jsonb,
  p_instruments jsonb,
  p_locks jsonb,
  p_lock_secrets jsonb,
  p_assignments jsonb,
  p_issues jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_asset_id uuid;
  v_student_id uuid;
  v_open_assignment_id uuid;
  v_open_student_id uuid;
  v_existing_hash text;
  v_desired integer := jsonb_array_length(coalesce(p_assets, '[]'::jsonb));
  v_up_to_date integer := 0;
  v_assignments_created integer := 0;
  v_assignments_existing integer := 0;
  v_issue_count integer := jsonb_array_length(coalesce(p_issues, '[]'::jsonb));
  v_summary jsonb;
begin
  if jsonb_typeof(coalesce(p_assets, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_instruments, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_locks, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_lock_secrets, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_assignments, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_issues, '[]'::jsonb)) <> 'array'
  then raise exception 'asset import payloads must be arrays'; end if;

  perform 1 from asset_import_runs
  where id = p_run_id and mode = 'apply' and status = 'running'
  for update;
  if not found then raise exception 'running apply import not found'; end if;

  for v_row in select value from jsonb_array_elements(coalesce(p_assets, '[]'::jsonb)) loop
    select source_hash into v_existing_hash
    from assets
    where source_system = v_row->>'source_system' and source_key = v_row->>'source_key';
    if found and v_existing_hash = coalesce(v_row->>'source_hash', '') then
      v_up_to_date := v_up_to_date + 1;
    end if;

    insert into assets (
      asset_type, asset_tag, display_name, lifecycle_status, operational_status,
      condition_summary, location, source_system, source_key, source_hash,
      last_verified_at, source_updated_at, metadata
    ) values (
      v_row->>'asset_type', coalesce(v_row->>'asset_tag', ''), v_row->>'display_name',
      coalesce(v_row->>'lifecycle_status', 'active'), coalesce(v_row->>'operational_status', 'unverified'),
      coalesce(v_row->>'condition_summary', ''), coalesce(v_row->>'location', ''),
      v_row->>'source_system', v_row->>'source_key', coalesce(v_row->>'source_hash', ''),
      nullif(v_row->>'last_verified_at', '')::timestamptz,
      nullif(v_row->>'source_updated_at', '')::timestamptz,
      coalesce(v_row->'metadata', '{}'::jsonb)
    )
    on conflict (source_system, source_key) do update set
      asset_type = excluded.asset_type,
      asset_tag = excluded.asset_tag,
      display_name = excluded.display_name,
      lifecycle_status = excluded.lifecycle_status,
      operational_status = excluded.operational_status,
      condition_summary = excluded.condition_summary,
      location = excluded.location,
      source_hash = excluded.source_hash,
      last_verified_at = excluded.last_verified_at,
      source_updated_at = excluded.source_updated_at,
      metadata = excluded.metadata;
  end loop;

  for v_row in select value from jsonb_array_elements(coalesce(p_instruments, '[]'::jsonb)) loop
    v_asset_id := null;
    select id into v_asset_id from assets
    where source_system = v_row->>'source_system' and source_key = v_row->>'source_key';
    if v_asset_id is null then raise exception 'instrument asset identity not found'; end if;
    insert into asset_instruments (
      asset_id, instrument_type, brand, model, model_markings, serial_number,
      serial_location, finish, key_pitch, level, play_status, repair_needed,
      repair_priority, visible_issues
    ) values (
      v_asset_id, coalesce(v_row->>'instrument_type', ''), coalesce(v_row->>'brand', ''),
      coalesce(v_row->>'model', ''), coalesce(v_row->>'model_markings', ''),
      coalesce(v_row->>'serial_number', ''), coalesce(v_row->>'serial_location', ''),
      coalesce(v_row->>'finish', ''), coalesce(v_row->>'key_pitch', ''),
      coalesce(v_row->>'level', ''), coalesce(v_row->>'play_status', ''),
      coalesce(v_row->>'repair_needed', ''), coalesce(v_row->>'repair_priority', ''),
      coalesce(v_row->>'visible_issues', '')
    ) on conflict (asset_id) do update set
      instrument_type = excluded.instrument_type,
      brand = excluded.brand,
      model = excluded.model,
      model_markings = excluded.model_markings,
      serial_number = excluded.serial_number,
      serial_location = excluded.serial_location,
      finish = excluded.finish,
      key_pitch = excluded.key_pitch,
      level = excluded.level,
      play_status = excluded.play_status,
      repair_needed = excluded.repair_needed,
      repair_priority = excluded.repair_priority,
      visible_issues = excluded.visible_issues;
  end loop;

  for v_row in select value from jsonb_array_elements(coalesce(p_locks, '[]'::jsonb)) loop
    v_asset_id := null;
    select id into v_asset_id from assets
    where source_system = v_row->>'source_system' and source_key = v_row->>'source_key';
    if v_asset_id is null then raise exception 'lock asset identity not found'; end if;
    insert into asset_locks (asset_id, serial_number, master_key, confidence, inventoried, notes)
    values (
      v_asset_id, coalesce(v_row->>'serial_number', ''), coalesce(v_row->>'master_key', ''),
      coalesce(v_row->>'confidence', ''),
      case when jsonb_typeof(v_row->'inventoried') = 'boolean' then (v_row->>'inventoried')::boolean else null end,
      coalesce(v_row->>'notes', '')
    ) on conflict (asset_id) do update set
      serial_number = excluded.serial_number,
      master_key = excluded.master_key,
      confidence = excluded.confidence,
      inventoried = excluded.inventoried,
      notes = excluded.notes;
  end loop;

  for v_row in select value from jsonb_array_elements(coalesce(p_lock_secrets, '[]'::jsonb)) loop
    v_asset_id := null;
    select id into v_asset_id from assets
    where source_system = v_row->>'source_system' and source_key = v_row->>'source_key';
    if v_asset_id is null then raise exception 'lock secret asset identity not found'; end if;
    insert into asset_lock_secrets (asset_id, combination, updated_at)
    values (v_asset_id, v_row->>'combination', now())
    on conflict (asset_id) do update set combination = excluded.combination, updated_at = excluded.updated_at;
  end loop;

  for v_row in select value from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) loop
    v_asset_id := null;
    v_student_id := nullif(v_row->>'student_id', '')::uuid;
    v_open_assignment_id := null;
    v_open_student_id := null;
    select id into v_asset_id from assets
    where source_system = v_row->>'source_system' and source_key = v_row->>'source_key';
    if v_asset_id is null then raise exception 'assignment asset identity not found'; end if;

    if not exists (select 1 from portal_students where id = v_student_id and status = 'active') then
      insert into asset_import_issues (import_run_id, source_key, issue_type, summary, candidates)
      values (p_run_id, v_row->>'source_key', 'student_became_inactive',
        'The exactly matched student is no longer active; no assignment was created.',
        jsonb_build_array(jsonb_build_object('student_id', v_student_id)));
      v_issue_count := v_issue_count + 1;
      continue;
    end if;

    select id, student_id into v_open_assignment_id, v_open_student_id
    from asset_assignments
    where asset_id = v_asset_id and ends_at is null
      and assignment_status in ('current','provisional')
    for update;
    if v_open_assignment_id is null then
      insert into asset_assignments (
        asset_id, student_id, program_group_id, holder_label, starts_at, ends_at,
        assignment_status, source_system, source_ref, notes
      ) values (
        v_asset_id, v_student_id, null, '', null, null, 'provisional',
        v_row->>'source_system', coalesce(v_row->>'source_key', ''), ''
      );
      v_assignments_created := v_assignments_created + 1;
    elsif v_open_student_id = v_student_id then
      v_assignments_existing := v_assignments_existing + 1;
    else
      insert into asset_import_issues (import_run_id, source_key, issue_type, summary, candidates)
      values (p_run_id, v_row->>'source_key', 'current_assignment_conflict',
        'The asset already has a different open assignment; neither assignment was changed.',
        jsonb_build_array(
          jsonb_build_object('student_id', v_open_student_id, 'assignment_id', v_open_assignment_id),
          jsonb_build_object('student_id', v_student_id)
        ));
      v_issue_count := v_issue_count + 1;
    end if;
  end loop;

  insert into asset_import_issues (import_run_id, source_key, issue_type, summary, candidates)
  select p_run_id, value->>'sourceKey', value->>'issueType', value->>'summary',
    coalesce(value->'candidates', '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_issues, '[]'::jsonb));

  v_summary := jsonb_build_object(
    'desired_assets', v_desired,
    'assets_up_to_date_before_run', v_up_to_date,
    'assets_to_upsert', 0,
    'assignments_to_create', v_assignments_created,
    'assignments_already_open', v_assignments_existing,
    'issues', v_issue_count,
    'history_inferred', false
  );
  update asset_import_runs set
    status = 'complete', completed_at = now(), matched_rows = v_desired,
    issue_rows = v_issue_count, summary = v_summary
  where id = p_run_id;
  return jsonb_build_object('runId', p_run_id, 'summary', v_summary);
end;
$$;

revoke all on function public.apply_asset_import_transaction(uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.apply_asset_import_transaction(uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) to service_role;

create or replace function public.create_fee_charges_with_audit(
  p_student_ids uuid[], p_category text, p_label text, p_amount_cents integer,
  p_source text, p_kind text, p_created_by text, p_notes text, p_actor_staff_id uuid,
  p_route text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not exists (select 1 from staff where id = p_actor_staff_id) then raise exception 'staff actor required'; end if;
  if coalesce(array_length(p_student_ids, 1), 0) = 0 then raise exception 'student ids required'; end if;
  if p_amount_cents <= 0 or p_amount_cents > 1000000 then raise exception 'invalid amount'; end if;
  if nullif(btrim(p_category), '') is null then raise exception 'category required'; end if;
  if p_source not in ('manual','bulk','signup') then raise exception 'invalid source'; end if;
  if p_kind not in ('fee','funding_goal') then raise exception 'invalid kind'; end if;
  if exists (
    select 1 from unnest(p_student_ids) requested(id)
    left join portal_students student on student.id = requested.id and student.status = 'active'
    where student.id is null
  ) then raise exception 'active students required'; end if;

  insert into fee_charges (student_id, category, label, amount_cents, source, kind, created_by, notes)
  select distinct id, btrim(p_category), left(coalesce(p_label, ''), 200), p_amount_cents,
    p_source, p_kind, left(coalesce(p_created_by, ''), 200), left(coalesce(p_notes, ''), 500)
  from unnest(p_student_ids) requested(id);
  get diagnostics v_count = row_count;

  insert into audit_log (actor_type, actor_id, actor_name, action, table_name, record_id, changes, route)
  select 'staff', staff.id::text, staff.display_name, 'insert', 'fee_charges',
    array_to_string(p_student_ids, ','),
    jsonb_build_object('student_ids', p_student_ids, 'category', p_category, 'amount_cents', p_amount_cents, 'inserted', v_count),
    p_route
  from staff where id = p_actor_staff_id;
  return v_count;
end;
$$;

create or replace function public.update_fee_charge_with_audit(
  p_charge_id uuid, p_status text, p_notes text, p_actor_staff_id uuid, p_route text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_old_status text;
begin
  if not exists (select 1 from staff where id = p_actor_staff_id) then raise exception 'staff actor required'; end if;
  if p_status not in ('active','void') then raise exception 'invalid status'; end if;
  select status into v_old_status from fee_charges where id = p_charge_id for update;
  if v_old_status is null then raise exception 'charge not found'; end if;
  update fee_charges set status = p_status,
    notes = case when p_notes is null then notes else left(p_notes, 500) end
  where id = p_charge_id;
  insert into audit_log (actor_type, actor_id, actor_name, action, table_name, record_id, changes, route)
  select 'staff', staff.id::text, staff.display_name, 'update', 'fee_charges', p_charge_id::text,
    jsonb_build_object('status', jsonb_build_object('old', v_old_status, 'new', p_status)), p_route
  from staff where id = p_actor_staff_id;
  return p_charge_id;
end;
$$;

create or replace function public.record_fee_payment_with_audit(
  p_student_id uuid, p_amount_cents integer, p_method text, p_category text, p_kind text,
  p_invoice_id text, p_recorded_by text, p_received_at timestamptz,
  p_payer_name text, p_check_number text, p_notes text, p_actor_staff_id uuid,
  p_route text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not exists (select 1 from staff where id = p_actor_staff_id) then raise exception 'staff actor required'; end if;
  if not exists (select 1 from portal_students where id = p_student_id and status = 'active') then raise exception 'active student required'; end if;
  if p_amount_cents <= 0 or p_amount_cents > 1000000 then raise exception 'invalid amount'; end if;
  if p_method not in ('check','cash','credit','adjustment') then raise exception 'invalid offline method'; end if;
  if nullif(btrim(p_category), '') is null then raise exception 'category required'; end if;
  if p_kind not in ('fee','funding_goal') then raise exception 'invalid kind'; end if;
  if not exists (
    select 1 from fee_charges
    where student_id = p_student_id and category = btrim(p_category)
      and kind = p_kind and status = 'active'
  ) then raise exception 'matching active charge or campaign goal required'; end if;
  insert into fee_payments (
    student_id, amount_cents, method, status, category, kind, invoice_id, recorded_by,
    received_at, payer_name, check_number, is_sponsorship, notes
  ) values (
    p_student_id, p_amount_cents, p_method, 'completed', btrim(p_category), p_kind, p_invoice_id,
    left(coalesce(p_recorded_by, ''), 200), p_received_at, left(coalesce(p_payer_name, ''), 200),
    case when p_method = 'check' then left(coalesce(p_check_number, ''), 50) else '' end,
    false, left(coalesce(p_notes, ''), 500)
  ) returning id into v_id;
  insert into audit_log (actor_type, actor_id, actor_name, action, table_name, record_id, changes, route)
  select 'staff', staff.id::text, staff.display_name, 'insert', 'fee_payments', v_id::text,
    jsonb_build_object('student_id', p_student_id, 'amount_cents', p_amount_cents, 'method', p_method, 'category', p_category, 'kind', p_kind), p_route
  from staff where id = p_actor_staff_id;
  return v_id;
end;
$$;

create or replace function public.update_fee_payment_with_audit(
  p_payment_id uuid, p_status text, p_notes text, p_actor_staff_id uuid, p_route text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_old_status text;
begin
  if not exists (select 1 from staff where id = p_actor_staff_id) then raise exception 'staff actor required'; end if;
  if p_status not in ('completed','refunded','failed') then raise exception 'invalid status'; end if;
  select status into v_old_status from fee_payments where id = p_payment_id for update;
  if v_old_status is null then raise exception 'payment not found'; end if;
  update fee_payments set status = p_status,
    notes = case when p_notes is null then notes else left(p_notes, 500) end
  where id = p_payment_id;
  insert into audit_log (actor_type, actor_id, actor_name, action, table_name, record_id, changes, route)
  select 'staff', staff.id::text, staff.display_name, 'update', 'fee_payments', p_payment_id::text,
    jsonb_build_object('status', jsonb_build_object('old', v_old_status, 'new', p_status)), p_route
  from staff where id = p_actor_staff_id;
  return p_payment_id;
end;
$$;

create or replace function public.settle_online_fee_payment_with_audit(
  p_payment_id uuid, p_capture_id text, p_actor_type text, p_actor_id text,
  p_actor_name text, p_route text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_method text;
  v_kind text;
  v_student_id uuid;
  v_amount_cents integer;
begin
  if p_actor_type not in ('parent','system') then raise exception 'invalid payment actor'; end if;
  if nullif(btrim(p_capture_id), '') is null then raise exception 'capture id required'; end if;
  select status, method, kind, student_id, amount_cents
    into v_status, v_method, v_kind, v_student_id, v_amount_cents
  from fee_payments where id = p_payment_id for update;
  if v_status is null then raise exception 'payment not found'; end if;
  if v_method <> 'paypal' or v_kind <> 'fee' then raise exception 'online fee payment required'; end if;
  if v_status = 'completed' then return p_payment_id; end if;
  if v_status <> 'pending' then raise exception 'payment is not pending'; end if;

  update fee_payments set
    status = 'completed', paypal_capture_id = btrim(p_capture_id), received_at = now()
  where id = p_payment_id;
  insert into audit_log (actor_type, actor_id, actor_name, action, table_name, record_id, changes, route)
  values (
    p_actor_type, nullif(p_actor_id, ''), nullif(p_actor_name, ''), 'settle_online_payment',
    'fee_payments', p_payment_id::text,
    jsonb_build_object('student_id', v_student_id, 'amount_cents', v_amount_cents,
      'status', jsonb_build_object('old', v_status, 'new', 'completed')),
    p_route
  );
  return p_payment_id;
end;
$$;

revoke all on function public.create_fee_charges_with_audit(uuid[],text,text,integer,text,text,text,text,uuid,text) from public, anon, authenticated;
revoke all on function public.update_fee_charge_with_audit(uuid,text,text,uuid,text) from public, anon, authenticated;
revoke all on function public.record_fee_payment_with_audit(uuid,integer,text,text,text,text,text,timestamptz,text,text,text,uuid,text) from public, anon, authenticated;
revoke all on function public.update_fee_payment_with_audit(uuid,text,text,uuid,text) from public, anon, authenticated;
revoke all on function public.settle_online_fee_payment_with_audit(uuid,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.create_fee_charges_with_audit(uuid[],text,text,integer,text,text,text,text,uuid,text) to service_role;
grant execute on function public.update_fee_charge_with_audit(uuid,text,text,uuid,text) to service_role;
grant execute on function public.record_fee_payment_with_audit(uuid,integer,text,text,text,text,text,timestamptz,text,text,text,uuid,text) to service_role;
grant execute on function public.update_fee_payment_with_audit(uuid,text,text,uuid,text) to service_role;
grant execute on function public.settle_online_fee_payment_with_audit(uuid,text,text,text,text,text) to service_role;

drop trigger if exists assets_updated_at on public.assets;
create trigger assets_updated_at before update on public.assets
  for each row execute function set_updated_at();
drop trigger if exists asset_assignments_updated_at on public.asset_assignments;
create trigger asset_assignments_updated_at before update on public.asset_assignments
  for each row execute function set_updated_at();
drop trigger if exists form_definitions_updated_at on public.form_definitions;
create trigger form_definitions_updated_at before update on public.form_definitions
  for each row execute function set_updated_at();
drop trigger if exists form_requirements_updated_at on public.form_requirements;
create trigger form_requirements_updated_at before update on public.form_requirements
  for each row execute function set_updated_at();
drop trigger if exists student_form_requirements_updated_at on public.student_form_requirements;
create trigger student_form_requirements_updated_at before update on public.student_form_requirements
  for each row execute function set_updated_at();

alter table public.assets enable row level security;
alter table public.asset_instruments enable row level security;
alter table public.asset_locks enable row level security;
alter table public.asset_lock_secrets enable row level security;
alter table public.asset_assignments enable row level security;
alter table public.asset_relationships enable row level security;
alter table public.asset_events enable row level security;
alter table public.asset_import_runs enable row level security;
alter table public.asset_import_issues enable row level security;
alter table public.form_definitions enable row level security;
alter table public.form_versions enable row level security;
alter table public.form_requirements enable row level security;
alter table public.student_form_requirements enable row level security;
alter table public.form_submission_references enable row level security;
alter table public.form_requirement_events enable row level security;

revoke all privileges on table public.assets from anon, authenticated;
revoke all privileges on table public.asset_instruments from anon, authenticated;
revoke all privileges on table public.asset_locks from anon, authenticated;
revoke all privileges on table public.asset_lock_secrets from anon, authenticated;
revoke all privileges on table public.asset_assignments from anon, authenticated;
revoke all privileges on table public.asset_relationships from anon, authenticated;
revoke all privileges on table public.asset_events from anon, authenticated;
revoke all privileges on table public.asset_import_runs from anon, authenticated;
revoke all privileges on table public.asset_import_issues from anon, authenticated;
revoke all privileges on table public.form_definitions from anon, authenticated;
revoke all privileges on table public.form_versions from anon, authenticated;
revoke all privileges on table public.form_requirements from anon, authenticated;
revoke all privileges on table public.student_form_requirements from anon, authenticated;
revoke all privileges on table public.form_submission_references from anon, authenticated;
revoke all privileges on table public.form_requirement_events from anon, authenticated;

revoke all privileges on table public.fee_charges from anon, authenticated;
revoke all privileges on table public.fee_payments from anon, authenticated;
revoke all privileges on table public.paypal_webhook_events from anon, authenticated;
revoke all privileges on table public.spring_trip_refund_credits from anon, authenticated;
revoke all privileges on table public.spring_trip_refund_submissions from anon, authenticated;
revoke all privileges on table public.families from anon, authenticated;
revoke all privileges on table public.businesses from anon, authenticated;
revoke all privileges on table public.staff from anon, authenticated;
revoke all privileges on table public.prospects from anon, authenticated;
revoke all privileges on table public.business_outreach from anon, authenticated;
revoke all privileges on table public.sponsor_gifts from anon, authenticated;
revoke all privileges on table public.sponsor_student_links from anon, authenticated;
revoke all privileges on table public.audit_log from anon, authenticated;

revoke all privileges on table public.student_fee_balances from anon, authenticated;
revoke all privileges on table public.sponsor_family_totals from anon, authenticated;
revoke all privileges on table public.sponsor_student_totals from anon, authenticated;
revoke all privileges on table public.prospect_dedup from anon, authenticated;
revoke all privileges on table public.business_outreach_rollup from anon, authenticated;
revoke all privileges on table public.business_touchpoints from anon, authenticated;
revoke all privileges on table public.student_program_fee_summary from anon, authenticated;
revoke all privileges on table public.student_campaign_summary from anon, authenticated;

notify pgrst, 'reload schema';
