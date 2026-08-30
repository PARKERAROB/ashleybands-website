-- Current program groups, program memberships, and school-class projections.
-- provenance: accepted Ensembles & Memberships prototype plus the current
-- BandsofAHS roster projection. Program membership and school enrollment are
-- deliberately separate domains: class syncs must never change a group roster.

create table if not exists program_groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  group_type text not null check (group_type in ('ensemble', 'activity', 'team', 'trip', 'other')),
  school_year text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  owner text not null default 'AshleyBands staff',
  starts_on date,
  ends_on date,
  source text not null,
  source_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'active' and ends_on is null) or (status = 'inactive' and ends_on is not null))
);

create table if not exists program_memberships (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references program_groups(id) on delete restrict,
  student_id uuid not null references portal_students(id) on delete restrict,
  membership_role text,
  starts_on date,
  ends_on date,
  source text not null,
  source_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists program_memberships_one_current_idx
  on program_memberships (group_id, student_id) where ends_on is null;
create index if not exists program_memberships_student_current_idx
  on program_memberships (student_id, group_id) where ends_on is null;

create table if not exists program_membership_events (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid references program_memberships(id) on delete restrict,
  group_id uuid not null references program_groups(id) on delete restrict,
  student_id uuid not null references portal_students(id) on delete restrict,
  event_type text not null check (event_type in ('added', 'ended', 'role_changed', 'restored')),
  effective_at timestamptz not null default now(),
  changed_by text,
  source text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists program_membership_events_student_idx
  on program_membership_events (student_id, effective_at desc);

create table if not exists school_class_sections (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  section_code text,
  school_year text not null,
  term text,
  school_id uuid references portal_schools(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'inactive')),
  starts_on date,
  ends_on date,
  source text not null,
  source_reference text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'active' and ends_on is null) or (status = 'inactive' and ends_on is not null))
);

create table if not exists student_class_enrollments (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references school_class_sections(id) on delete restrict,
  student_id uuid not null references portal_students(id) on delete restrict,
  starts_on date,
  ends_on date,
  source text not null,
  source_reference text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists student_class_enrollments_one_current_idx
  on student_class_enrollments (section_id, student_id) where ends_on is null;
create index if not exists student_class_enrollments_student_current_idx
  on student_class_enrollments (student_id, section_id) where ends_on is null;

create table if not exists group_class_expectations (
  group_id uuid not null references program_groups(id) on delete cascade,
  section_id uuid not null references school_class_sections(id) on delete cascade,
  relationship_type text not null default 'expected'
    check (relationship_type in ('expected', 'common', 'informational')),
  source text not null,
  created_at timestamptz not null default now(),
  primary key (group_id, section_id)
);

drop trigger if exists program_groups_updated_at on program_groups;
create trigger program_groups_updated_at before update on program_groups
  for each row execute function set_updated_at();
drop trigger if exists program_memberships_updated_at on program_memberships;
create trigger program_memberships_updated_at before update on program_memberships
  for each row execute function set_updated_at();
drop trigger if exists school_class_sections_updated_at on school_class_sections;
create trigger school_class_sections_updated_at before update on school_class_sections
  for each row execute function set_updated_at();
drop trigger if exists student_class_enrollments_updated_at on student_class_enrollments;
create trigger student_class_enrollments_updated_at before update on student_class_enrollments
  for each row execute function set_updated_at();

insert into program_groups (code, name, group_type, school_year, source, source_reference)
values
  ('concert-band-2026-27', 'Concert Band', 'ensemble', '2026-27', 'bdos_csv_projection', 'portal_students.ensemble_2026'),
  ('percussion-ensemble-2026-27', 'Percussion Ensemble', 'ensemble', '2026-27', 'bdos_csv_projection', 'portal_students.ensemble_2026'),
  ('wind-ensemble-2026-27', 'Wind Ensemble', 'ensemble', '2026-27', 'bdos_csv_projection', 'portal_students.ensemble_2026'),
  ('marching-band-2026', 'Marching Band', 'activity', '2026-27', 'bdos_csv_projection', 'portal_students.marching_2026'),
  ('color-guard-2026', 'Color Guard', 'team', '2026-27', 'bdos_csv_projection', 'portal_students.marching_2026 plus current guard role/assignment')
on conflict (code) do update set
  name = excluded.name,
  group_type = excluded.group_type,
  status = 'active',
  ends_on = null,
  source = excluded.source,
  source_reference = excluded.source_reference,
  updated_at = now();

-- Reconcile the complete roster-owned membership projection. This function is
-- repeatable: it adds desired rows, updates roles, ends source-owned rows that
-- disappeared, and records every change. Staff-owned memberships are untouched.
create or replace function reconcile_program_memberships_from_roster(p_student_ids uuid[] default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted int := 0;
  v_ended int := 0;
  v_role_changed int := 0;
  v_unmapped text[];
begin
  select array_agg(distinct normalized order by normalized)
  into v_unmapped
  from (
    select lower(trim(value)) normalized
    from portal_students student
    cross join lateral regexp_split_to_table(coalesce(student.ensemble_2026, ''), '[;,|]') value
    where lower(coalesce(student.status, '')) = 'active'
      and (p_student_ids is null or student.id = any(p_student_ids))
      and trim(value) <> ''
      and lower(trim(value)) not in ('concert band', 'percussion ensemble', 'wind ensemble', 'marching band', 'color guard')
  ) values_to_check;
  if cardinality(v_unmapped) > 0 then
    raise exception 'Unmapped current ensemble values: %', array_to_string(v_unmapped, ', ')
      using errcode = '22023';
  end if;

  create temporary table desired_program_memberships (
    group_id uuid not null,
    student_id uuid not null,
    membership_role text,
    source_reference text not null,
    primary key (group_id, student_id)
  ) on commit drop;

  insert into desired_program_memberships (group_id, student_id, membership_role, source_reference)
  select groups.id, student.id, null, 'portal_students.ensemble_2026'
  from portal_students student
  cross join lateral regexp_split_to_table(coalesce(student.ensemble_2026, ''), '[;,|]') value
  join program_groups groups on groups.code = case lower(trim(value))
    when 'concert band' then 'concert-band-2026-27'
    when 'percussion ensemble' then 'percussion-ensemble-2026-27'
    when 'wind ensemble' then 'wind-ensemble-2026-27'
    when 'marching band' then 'marching-band-2026'
    when 'color guard' then 'color-guard-2026'
    else null
  end
  where lower(coalesce(student.status, '')) = 'active'
    and (p_student_ids is null or student.id = any(p_student_ids))
  on conflict (group_id, student_id) do update set source_reference = excluded.source_reference;

  insert into desired_program_memberships (group_id, student_id, membership_role, source_reference)
  select groups.id, student.id,
    coalesce(nullif(student.marching_assignment_2026, ''), nullif(student.mb_role_2026, '')),
    'portal_students.marching_2026'
  from portal_students student
  join program_groups groups on groups.code = 'marching-band-2026'
  where lower(coalesce(student.status, '')) = 'active'
    and (p_student_ids is null or student.id = any(p_student_ids))
    and lower(trim(coalesce(student.marching_2026, ''))) in ('yes', 'active', 'marching', 'true', '1')
  on conflict (group_id, student_id) do update set
    membership_role = excluded.membership_role,
    source_reference = excluded.source_reference;

  insert into desired_program_memberships (group_id, student_id, membership_role, source_reference)
  select groups.id, student.id,
    coalesce(nullif(student.marching_assignment_2026, ''), nullif(student.marching_role_category_2026, ''), nullif(student.mb_role_2026, ''), nullif(student.instrument_2026, '')),
    'portal_students.marching_2026 plus current guard role/assignment'
  from portal_students student
  join program_groups groups on groups.code = 'color-guard-2026'
  where lower(coalesce(student.status, '')) = 'active'
    and (p_student_ids is null or student.id = any(p_student_ids))
    and lower(trim(coalesce(student.marching_2026, ''))) in ('yes', 'active', 'marching', 'true', '1')
    and (
      lower(coalesce(student.marching_role_category_2026, '')) = 'color guard member'
      or lower(coalesce(student.marching_assignment_2026, '')) like '%guard%'
      or lower(coalesce(student.instrument_2026, '')) in ('color guard', 'guard')
      or lower(coalesce(student.mb_role_2026, '')) like '%color guard%'
      or lower(coalesce(student.mb_role_2026, '')) = 'guard'
    )
  on conflict (group_id, student_id) do update set
    membership_role = excluded.membership_role,
    source_reference = excluded.source_reference;

  with changed as (
    update program_memberships membership
    set membership_role = desired.membership_role,
      source_reference = desired.source_reference,
      updated_at = now()
    from desired_program_memberships desired
    where membership.group_id = desired.group_id
      and membership.student_id = desired.student_id
      and membership.ends_on is null
      and membership.source = 'bdos_csv_projection'
      and membership.membership_role is distinct from desired.membership_role
    returning membership.*
  ), events as (
    insert into program_membership_events (
      membership_id, group_id, student_id, event_type, effective_at, changed_by, source, detail
    )
    select id, group_id, student_id, 'role_changed', now(), 'roster_reconciliation', source,
      jsonb_build_object('reason', 'Roster-owned role changed')
    from changed
    returning 1
  )
  select count(*) into v_role_changed from events;

  with ended as (
    update program_memberships membership
    set ends_on = current_date, updated_at = now()
    where membership.ends_on is null
      and membership.source = 'bdos_csv_projection'
      and (p_student_ids is null or membership.student_id = any(p_student_ids))
      and not exists (
        select 1 from desired_program_memberships desired
        where desired.group_id = membership.group_id and desired.student_id = membership.student_id
      )
    returning membership.*
  ), events as (
    insert into program_membership_events (
      membership_id, group_id, student_id, event_type, effective_at, changed_by, source, detail
    )
    select id, group_id, student_id, 'ended', now(), 'roster_reconciliation', source,
      jsonb_build_object('reason', 'Removed from current roster-owned projection')
    from ended
    returning 1
  )
  select count(*) into v_ended from events;

  with inserted as (
    insert into program_memberships (
      group_id, student_id, membership_role, starts_on, source, source_reference
    )
    select desired.group_id, desired.student_id, desired.membership_role, current_date,
      'bdos_csv_projection', desired.source_reference
    from desired_program_memberships desired
    where not exists (
      select 1 from program_memberships membership
      where membership.group_id = desired.group_id
        and membership.student_id = desired.student_id
        and membership.ends_on is null
    )
    returning *
  ), events as (
    insert into program_membership_events (
      membership_id, group_id, student_id, event_type, effective_at, changed_by, source, detail
    )
    select id, group_id, student_id, 'added', now(), 'roster_reconciliation', source,
      jsonb_build_object('reason', 'Current roster-owned projection')
    from inserted
    returning 1
  )
  select count(*) into v_inserted from events;

  return jsonb_build_object(
    'inserted', v_inserted,
    'ended', v_ended,
    'roleChanged', v_role_changed,
    'desired', (select count(*) from desired_program_memberships)
  );
end;
$$;

create or replace function portal_apply_participation_change(
  p_student_id uuid,
  p_band_period text,
  p_ensemble text,
  p_instrument text,
  p_marching text,
  p_marching_role_category text,
  p_marching_assignment text,
  p_changed_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update portal_students
  set band_period_2026 = nullif(trim(p_band_period), ''),
    ensemble_2026 = nullif(trim(p_ensemble), ''),
    instrument_2026 = nullif(trim(p_instrument), ''),
    marching_2026 = nullif(trim(p_marching), ''),
    marching_role_category_2026 = nullif(trim(p_marching_role_category), ''),
    marching_assignment_2026 = nullif(trim(p_marching_assignment), ''),
    updated_at = coalesce(p_changed_at, now())
  where id = p_student_id;
  if not found then raise exception 'Student not found' using errcode = 'P0002'; end if;
  perform reconcile_program_memberships_from_roster(array[p_student_id]);
  return jsonb_build_object('ok', true, 'studentId', p_student_id);
end;
$$;

create or replace function portal_set_student_status_and_reconcile(p_student_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update portal_students set status = nullif(trim(p_status), ''), updated_at = now()
  where id = p_student_id;
  if not found then raise exception 'Student not found' using errcode = 'P0002'; end if;
  perform reconcile_program_memberships_from_roster(array[p_student_id]);
  return jsonb_build_object('ok', true, 'studentId', p_student_id, 'status', nullif(trim(p_status), ''));
end;
$$;

revoke all on function reconcile_program_memberships_from_roster(uuid[]) from public, anon, authenticated;
revoke all on function portal_apply_participation_change(uuid,text,text,text,text,text,text,timestamptz) from public, anon, authenticated;
revoke all on function portal_set_student_status_and_reconcile(uuid,text) from public, anon, authenticated;
grant execute on function reconcile_program_memberships_from_roster(uuid[]) to service_role;
grant execute on function portal_apply_participation_change(uuid,text,text,text,text,text,text,timestamptz) to service_role;
grant execute on function portal_set_student_status_and_reconcile(uuid,text) to service_role;

select reconcile_program_memberships_from_roster(null);

alter table public.program_groups enable row level security;
alter table public.program_memberships enable row level security;
alter table public.program_membership_events enable row level security;
alter table public.school_class_sections enable row level security;
alter table public.student_class_enrollments enable row level security;
alter table public.group_class_expectations enable row level security;

revoke all privileges on table public.program_groups from anon, authenticated;
revoke all privileges on table public.program_memberships from anon, authenticated;
revoke all privileges on table public.program_membership_events from anon, authenticated;
revoke all privileges on table public.school_class_sections from anon, authenticated;
revoke all privileges on table public.student_class_enrollments from anon, authenticated;
revoke all privileges on table public.group_class_expectations from anon, authenticated;

comment on table program_memberships is
  'AshleyBands-owned current and historical program group membership. Current rows have no ends_on date.';
comment on table student_class_enrollments is
  'School-class enrollment projection, kept separate from program membership. A class sync must never mutate program_memberships.';
comment on column school_class_sections.source is
  'Display this source accurately. bdos_csv_projection is not an official live Infinite Campus feed.';

notify pgrst, 'reload schema';
