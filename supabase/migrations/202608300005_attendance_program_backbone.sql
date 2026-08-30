-- Stable program-event attendance scope and roster snapshots.
-- provenance: canonical calendar occurrences remain identified by
-- calendar_event_id:local-date. Expected students come from current normalized
-- program memberships until the occurrence is explicitly locked for marking.

alter table public.attendance_events
  add column if not exists lifecycle_state text not null default 'scheduled',
  add column if not exists roster_locked_at timestamptz,
  add column if not exists roster_locked_by_staff_id uuid references public.staff(id) on delete set null,
  add column if not exists roster_certification_state text not null default 'unlocked',
  add column if not exists roster_certified_at timestamptz,
  add column if not exists roster_certified_by_staff_id uuid references public.staff(id) on delete set null,
  add column if not exists roster_certification_note text,
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by_staff_id uuid references public.staff(id) on delete set null,
  add column if not exists completion_note text,
  add column if not exists correction_opened_at timestamptz,
  add column if not exists correction_opened_by_staff_id uuid references public.staff(id) on delete set null,
  add column if not exists correction_reason text,
  add column if not exists supersedes_event_id uuid references public.attendance_events(id) on delete restrict,
  add column if not exists source_revision text;

alter table public.attendance_events
  drop constraint if exists attendance_events_lifecycle_state_check,
  add constraint attendance_events_lifecycle_state_check check (
    lifecycle_state in ('scheduled', 'prepared', 'open', 'completed', 'cancelled', 'superseded')
  ),
  drop constraint if exists attendance_events_completion_note_check,
  add constraint attendance_events_completion_note_check check (
    completion_note is null or char_length(completion_note) <= 500
  ),
  drop constraint if exists attendance_events_correction_reason_check,
  add constraint attendance_events_correction_reason_check check (
    correction_reason is null or char_length(correction_reason) <= 500
  ),
  drop constraint if exists attendance_events_roster_certification_state_check,
  add constraint attendance_events_roster_certification_state_check check (
    roster_certification_state in ('unlocked', 'certified', 'evidence_only', 'reconstructing')
  ),
  drop constraint if exists attendance_events_roster_certification_note_check,
  add constraint attendance_events_roster_certification_note_check check (
    roster_certification_note is null or char_length(roster_certification_note) <= 500
  ),
  drop constraint if exists attendance_events_roster_certification_check,
  add constraint attendance_events_roster_certification_check check (
    (roster_certification_state = 'certified'
      and roster_certified_at is not null
      and roster_certified_by_staff_id is not null)
    or (roster_certification_state <> 'certified' and roster_certified_at is null)
  ),
  drop constraint if exists attendance_events_completion_state_check,
  add constraint attendance_events_completion_state_check check (
    (lifecycle_state = 'completed' and completed_at is not null and completed_by_staff_id is not null)
    or lifecycle_state <> 'completed'
  );

create table if not exists public.attendance_calendar_groups (
  calendar_event_id text not null,
  group_id uuid not null references public.program_groups(id) on delete restrict,
  source text not null default 'staff_configuration',
  source_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (calendar_event_id, group_id)
);

create table if not exists public.attendance_event_roster (
  attendance_event_id uuid not null references public.attendance_events(id) on delete restrict,
  student_id uuid not null references public.portal_students(id) on delete restrict,
  roster_state text not null default 'included' check (roster_state in ('included', 'removed')),
  role_snapshot text,
  basis text not null,
  source text not null,
  reconstruction_quality text not null default 'current_membership_preview'
    check (reconstruction_quality in (
      'current_membership_preview',
      'locked_membership_snapshot',
      'direct_adjustment',
      'observed_record_only'
    )),
  included_at timestamptz not null default now(),
  included_by_staff_id uuid references public.staff(id) on delete set null,
  removed_at timestamptz,
  removed_by_staff_id uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (attendance_event_id, student_id),
  check (
    (roster_state = 'included' and removed_at is null)
    or (roster_state = 'removed' and removed_at is not null)
  )
);

create table if not exists public.attendance_event_roster_groups (
  attendance_event_id uuid not null,
  student_id uuid not null,
  group_id uuid not null references public.program_groups(id) on delete restrict,
  source_membership_id uuid references public.program_memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (attendance_event_id, student_id, group_id),
  foreign key (attendance_event_id, student_id)
    references public.attendance_event_roster(attendance_event_id, student_id)
    on delete cascade
);

create table if not exists public.attendance_record_corrections (
  id uuid primary key default gen_random_uuid(),
  attendance_event_id uuid not null references public.attendance_events(id) on delete restrict,
  student_id uuid references public.portal_students(id) on delete restrict,
  action text not null check (action in ('student_removed_with_records', 'event_reopened')),
  reason text not null check (char_length(trim(reason)) between 1 and 500),
  previous_event jsonb,
  previous_observation jsonb,
  previous_exceptions jsonb,
  actor_staff_id uuid not null references public.staff(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_observation_revisions (
  id uuid primary key default gen_random_uuid(),
  attendance_event_id uuid not null references public.attendance_events(id) on delete restrict,
  student_id uuid not null references public.portal_students(id) on delete restrict,
  previous_observation jsonb,
  next_observation jsonb,
  correction_reason text not null check (char_length(trim(correction_reason)) between 1 and 500),
  actor_staff_id uuid not null references public.staff(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists attendance_event_roster_student_idx
  on public.attendance_event_roster(student_id, attendance_event_id);
create index if not exists attendance_event_roster_state_idx
  on public.attendance_event_roster(attendance_event_id, roster_state);
create index if not exists attendance_calendar_groups_group_idx
  on public.attendance_calendar_groups(group_id, calendar_event_id);

drop trigger if exists attendance_calendar_groups_updated_at on public.attendance_calendar_groups;
create trigger attendance_calendar_groups_updated_at before update on public.attendance_calendar_groups
  for each row execute function public.set_updated_at();
drop trigger if exists attendance_event_roster_updated_at on public.attendance_event_roster;
create trigger attendance_event_roster_updated_at before update on public.attendance_event_roster
  for each row execute function public.set_updated_at();

-- Only reviewed canonical calendar series are attendance-enabled. Concerts use
-- every current curricular ensemble; marching events use Marching Band.
insert into public.attendance_calendar_groups (
  calendar_event_id, group_id, source, source_reference
)
select mapping.calendar_event_id, groups.id, 'staff_configuration', mapping.source_reference
from (
  values
    ('evt-0007', 'marching-band-2026', 'Band Camp week 1'),
    ('evt-0008', 'marching-band-2026', 'Band Camp week 2'),
    ('evt-0108', 'marching-band-2026', 'Marching rehearsals'),
    ('evt-0009', 'marching-band-2026', 'Football EE Smith'),
    ('evt-0010', 'marching-band-2026', 'Football Fike'),
    ('evt-0012', 'marching-band-2026', 'Football Laney'),
    ('evt-0015', 'marching-band-2026', 'White Oak competition'),
    ('evt-0016', 'marching-band-2026', 'Football homecoming'),
    ('evt-0018', 'marching-band-2026', 'NHCS showcase'),
    ('evt-0020', 'marching-band-2026', 'Football West Brunswick'),
    ('evt-0022', 'marching-band-2026', 'Football Hoggard'),
    ('evt-0027', 'marching-band-2026', 'Christmas parade'),
    ('evt-0048', 'marching-band-2026', 'Azalea Festival parade'),
    ('evt-0019', 'concert-band-2026-27', 'Fall concert'),
    ('evt-0019', 'percussion-ensemble-2026-27', 'Fall concert'),
    ('evt-0019', 'wind-ensemble-2026-27', 'Fall concert'),
    ('evt-0028', 'concert-band-2026-27', 'Winter concert'),
    ('evt-0028', 'percussion-ensemble-2026-27', 'Winter concert'),
    ('evt-0028', 'wind-ensemble-2026-27', 'Winter concert'),
    ('evt-0053', 'concert-band-2026-27', 'Spring concert'),
    ('evt-0053', 'percussion-ensemble-2026-27', 'Spring concert'),
    ('evt-0053', 'wind-ensemble-2026-27', 'Spring concert')
) as mapping(calendar_event_id, group_code, source_reference)
join public.program_groups groups on groups.code = mapping.group_code
on conflict (calendar_event_id, group_id) do update set
  source = excluded.source,
  source_reference = excluded.source_reference,
  updated_at = now();

-- Historical evidence is preserved without inventing a complete denominator.
-- Existing observation/exception rows prove only that the student participated
-- in that record, so they are explicitly labeled observed_record_only.
insert into public.attendance_event_roster (
  attendance_event_id,
  student_id,
  basis,
  source,
  reconstruction_quality,
  included_at
)
select evidence.attendance_event_id,
  evidence.student_id,
  'Existing attendance observation or approved exception',
  'legacy_attendance_evidence',
  'observed_record_only',
  min(evidence.included_at)
from (
  select attendance_event_id, portal_student_id student_id, min(created_at) included_at
  from public.attendance_observations
  group by attendance_event_id, portal_student_id
  union all
  select attendance_event_id, portal_student_id student_id, min(created_at) included_at
  from public.attendance_exceptions
  group by attendance_event_id, portal_student_id
) evidence
group by evidence.attendance_event_id, evidence.student_id
on conflict (attendance_event_id, student_id) do nothing;

update public.attendance_events event
set lifecycle_state = 'open',
  roster_locked_at = coalesce(
    (select min(evidence.created_at)
     from (
       select observation.created_at
       from public.attendance_observations observation
       where observation.attendance_event_id = event.id
       union all
       select exception.created_at
       from public.attendance_exceptions exception
       where exception.attendance_event_id = event.id
     ) evidence),
    event.starts_at
  )
where exists (
  select 1 from public.attendance_observations observation
  where observation.attendance_event_id = event.id
  union all
  select 1 from public.attendance_exceptions exception
  where exception.attendance_event_id = event.id
)
and event.starts_at < now()
and event.lifecycle_state = 'scheduled';

update public.attendance_events event
set roster_certification_state = 'evidence_only',
  roster_certified_at = null,
  roster_certified_by_staff_id = null,
  roster_certification_note = null
where event.roster_locked_at is not null
  and exists (
    select 1 from public.attendance_event_roster roster
    where roster.attendance_event_id = event.id
      and roster.reconstruction_quality = 'observed_record_only'
  );

alter table public.attendance_observations
  drop constraint if exists attendance_observations_portal_student_id_fkey;
alter table public.attendance_observations
  add constraint attendance_observations_event_roster_fkey
  foreign key (attendance_event_id, portal_student_id)
  references public.attendance_event_roster(attendance_event_id, student_id)
  on delete restrict;

alter table public.attendance_exceptions
  drop constraint if exists attendance_exceptions_portal_student_id_fkey;
alter table public.attendance_exceptions
  add constraint attendance_exceptions_event_roster_fkey
  foreign key (attendance_event_id, portal_student_id)
  references public.attendance_event_roster(attendance_event_id, student_id)
  on delete restrict;

alter table public.band_camp_attendance_2026
  drop constraint if exists band_camp_attendance_2026_portal_student_id_fkey;
alter table public.band_camp_attendance_2026
  add constraint band_camp_attendance_2026_portal_student_id_fkey
  foreign key (portal_student_id) references public.portal_students(id) on delete restrict;

create or replace function public.reconcile_attendance_event_roster(
  p_event_id uuid,
  p_actor_staff_id uuid default null,
  p_lock boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.attendance_events%rowtype;
  v_group_count integer;
  v_roster_count integer;
begin
  select * into v_event
  from public.attendance_events
  where id = p_event_id
  for update;
  if not found then
    raise exception 'Attendance event not found' using errcode = 'P0002';
  end if;

  if v_event.roster_locked_at is not null then
    select count(*) into v_roster_count
    from public.attendance_event_roster
    where attendance_event_id = p_event_id and roster_state = 'included';
    return jsonb_build_object('locked', true, 'rosterCount', v_roster_count);
  end if;

  select count(*) into v_group_count
  from public.attendance_calendar_groups
  where calendar_event_id = v_event.calendar_event_id;
  if v_group_count = 0 then
    raise exception 'Attendance event has no configured program group' using errcode = '22023';
  end if;

  create temporary table desired_attendance_roster (
    student_id uuid primary key,
    role_snapshot text
  ) on commit drop;

  insert into desired_attendance_roster (student_id, role_snapshot)
  select membership.student_id,
    max(nullif(membership.membership_role, ''))
  from public.attendance_calendar_groups mapping
  join public.program_groups groups
    on groups.id = mapping.group_id and groups.status = 'active' and groups.ends_on is null
  join public.program_memberships membership
    on membership.group_id = mapping.group_id and membership.ends_on is null
  join public.portal_students student
    on student.id = membership.student_id and lower(coalesce(student.status, '')) = 'active'
  where mapping.calendar_event_id = v_event.calendar_event_id
    and (membership.starts_on is null
      or membership.starts_on <= (v_event.starts_at at time zone 'America/New_York')::date)
  group by membership.student_id;

  select count(*) into v_roster_count from desired_attendance_roster;
  if v_roster_count = 0 then
    raise exception 'Attendance event has no current students in its configured groups'
      using errcode = '22023';
  end if;

  delete from public.attendance_event_roster_groups bridge
  using public.attendance_event_roster roster
  where roster.attendance_event_id = p_event_id
    and bridge.attendance_event_id = roster.attendance_event_id
    and bridge.student_id = roster.student_id
    and roster.reconstruction_quality = 'current_membership_preview';

  delete from public.attendance_event_roster roster
  where roster.attendance_event_id = p_event_id
    and roster.reconstruction_quality = 'current_membership_preview';

  insert into public.attendance_event_roster (
    attendance_event_id,
    student_id,
    roster_state,
    role_snapshot,
    basis,
    source,
    reconstruction_quality,
    included_by_staff_id
  )
  select p_event_id,
    desired.student_id,
    'included',
    desired.role_snapshot,
    'Current normalized program membership',
    'program_memberships',
    case when p_lock then 'locked_membership_snapshot' else 'current_membership_preview' end,
    p_actor_staff_id
  from desired_attendance_roster desired
  on conflict (attendance_event_id, student_id) do update set
    roster_state = 'included',
    role_snapshot = excluded.role_snapshot,
    basis = excluded.basis,
    source = excluded.source,
    reconstruction_quality = case
      when public.attendance_event_roster.reconstruction_quality = 'observed_record_only'
        and not p_lock then public.attendance_event_roster.reconstruction_quality
      else excluded.reconstruction_quality
    end,
    removed_at = null,
    removed_by_staff_id = null,
    updated_at = now();

  insert into public.attendance_event_roster_groups (
    attendance_event_id, student_id, group_id, source_membership_id
  )
  select p_event_id, membership.student_id, membership.group_id, membership.id
  from public.attendance_calendar_groups mapping
  join public.program_groups groups
    on groups.id = mapping.group_id and groups.status = 'active' and groups.ends_on is null
  join public.program_memberships membership
    on membership.group_id = mapping.group_id and membership.ends_on is null
  join public.portal_students student
    on student.id = membership.student_id and lower(coalesce(student.status, '')) = 'active'
  where mapping.calendar_event_id = v_event.calendar_event_id
    and (membership.starts_on is null
      or membership.starts_on <= (v_event.starts_at at time zone 'America/New_York')::date)
  on conflict (attendance_event_id, student_id, group_id) do update set
    source_membership_id = excluded.source_membership_id;

  if p_lock then
    update public.attendance_event_roster
    set reconstruction_quality = 'locked_membership_snapshot', updated_at = now()
    where attendance_event_id = p_event_id
      and reconstruction_quality = 'current_membership_preview';
    update public.attendance_events
    set roster_locked_at = now(),
      roster_locked_by_staff_id = p_actor_staff_id,
      roster_certification_state = 'certified',
      roster_certified_at = now(),
      roster_certified_by_staff_id = p_actor_staff_id,
      roster_certification_note = 'Locked from normalized program memberships.',
      lifecycle_state = 'open',
      updated_at = now()
    where id = p_event_id
      and lifecycle_state in ('scheduled', 'prepared');
  else
    update public.attendance_events
    set lifecycle_state = case when lifecycle_state = 'scheduled' then 'prepared' else lifecycle_state end,
      updated_at = now()
    where id = p_event_id;
  end if;

  select count(*) into v_roster_count
  from public.attendance_event_roster
  where attendance_event_id = p_event_id and roster_state = 'included';
  return jsonb_build_object('locked', p_lock, 'rosterCount', v_roster_count, 'groupCount', v_group_count);
end;
$$;

revoke all on function public.reconcile_attendance_event_roster(uuid,uuid,boolean)
  from public, anon, authenticated;
grant execute on function public.reconcile_attendance_event_roster(uuid,uuid,boolean)
  to service_role;

create or replace function public.begin_historical_attendance_reconstruction(
  p_event_id uuid,
  p_actor_staff_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.attendance_events%rowtype;
begin
  select * into v_event from public.attendance_events where id = p_event_id for update;
  if not found then
    raise exception 'Attendance event not found' using errcode = 'P0002';
  end if;
  if v_event.starts_at >= now() then
    raise exception 'Use normal event preparation for a current or future event' using errcode = '22023';
  end if;
  if v_event.roster_locked_at is not null or v_event.lifecycle_state not in ('scheduled', 'prepared') then
    raise exception 'This historical event is already prepared or cannot be reconstructed' using errcode = '22023';
  end if;
  if exists (select 1 from public.attendance_event_roster where attendance_event_id = p_event_id)
    or exists (select 1 from public.attendance_observations where attendance_event_id = p_event_id)
    or exists (select 1 from public.attendance_exceptions where attendance_event_id = p_event_id) then
    raise exception 'This historical event already has saved attendance evidence' using errcode = '22023';
  end if;
  update public.attendance_events
  set roster_locked_at = now(),
    roster_locked_by_staff_id = p_actor_staff_id,
    roster_certification_state = 'reconstructing',
    roster_certified_at = null,
    roster_certified_by_staff_id = null,
    roster_certification_note = null,
    lifecycle_state = 'open',
    updated_at = now()
  where id = p_event_id;
  return jsonb_build_object('eventId', p_event_id, 'reconstructionStarted', true);
end;
$$;

create or replace function public.adjust_attendance_event_roster(
  p_event_id uuid,
  p_student_id uuid,
  p_include boolean,
  p_actor_staff_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.attendance_events%rowtype;
  v_student public.portal_students%rowtype;
  v_has_records boolean;
begin
  select * into v_event from public.attendance_events where id = p_event_id for update;
  if not found then
    raise exception 'Attendance event not found' using errcode = 'P0002';
  end if;
  if v_event.roster_locked_at is null then
    raise exception 'Prepare the attendance event before adjusting its roster' using errcode = '22023';
  end if;
  if v_event.lifecycle_state <> 'open' then
    raise exception 'This attendance event roster cannot be adjusted' using errcode = '22023';
  end if;

  select * into v_student from public.portal_students where id = p_student_id;
  if not found then
    raise exception 'Student not found' using errcode = 'P0002';
  end if;

  if p_include then
    insert into public.attendance_event_roster (
      attendance_event_id, student_id, roster_state, role_snapshot, basis, source,
      reconstruction_quality, included_by_staff_id, removed_at, removed_by_staff_id
    ) values (
      p_event_id, p_student_id, 'included', v_student.instrument_2026,
      coalesce(nullif(trim(p_reason), ''), 'Direct staff roster adjustment'),
      'staff_adjustment', 'direct_adjustment', p_actor_staff_id, null, null
    )
    on conflict (attendance_event_id, student_id) do update set
      roster_state = 'included',
      basis = excluded.basis,
      source = excluded.source,
      reconstruction_quality = 'direct_adjustment',
      included_at = now(),
      included_by_staff_id = excluded.included_by_staff_id,
      removed_at = null,
      removed_by_staff_id = null,
      updated_at = now();
  else
    select exists (
      select 1 from public.attendance_observations
      where attendance_event_id = p_event_id and portal_student_id = p_student_id
      union all
      select 1 from public.attendance_exceptions
      where attendance_event_id = p_event_id and portal_student_id = p_student_id
    ) into v_has_records;
    if v_has_records then
      raise exception 'Remove the saved attendance record before excluding this student'
        using errcode = '23503';
    end if;
    update public.attendance_event_roster
    set roster_state = 'removed',
      basis = coalesce(nullif(trim(p_reason), ''), 'Direct staff roster adjustment'),
      source = 'staff_adjustment',
      reconstruction_quality = 'direct_adjustment',
      removed_at = now(),
      removed_by_staff_id = p_actor_staff_id,
      updated_at = now()
    where attendance_event_id = p_event_id and student_id = p_student_id;
    if not found then
      raise exception 'Student is not in this event roster' using errcode = 'P0002';
    end if;
  end if;

  if v_event.roster_certification_state = 'certified' then
    update public.attendance_events
    set roster_certification_state = 'reconstructing',
      roster_certified_at = null,
      roster_certified_by_staff_id = null,
      roster_certification_note = null,
      updated_at = now()
    where id = p_event_id;
  end if;

  return jsonb_build_object(
    'eventId', p_event_id,
    'studentId', p_student_id,
    'included', p_include
  );
end;
$$;

create or replace function public.certify_attendance_event_roster(
  p_event_id uuid,
  p_actor_staff_id uuid,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.attendance_events%rowtype;
  v_roster_count integer;
  v_note text;
begin
  select * into v_event from public.attendance_events where id = p_event_id for update;
  if not found then
    raise exception 'Attendance event not found' using errcode = 'P0002';
  end if;
  if v_event.roster_locked_at is null or v_event.lifecycle_state <> 'open' then
    raise exception 'Only an open locked event roster can be certified' using errcode = '22023';
  end if;
  if v_event.roster_certification_state not in ('reconstructing', 'evidence_only') then
    raise exception 'This event roster does not need manual certification' using errcode = '22023';
  end if;
  v_note := nullif(left(trim(coalesce(p_note, '')), 500), '');
  if v_note is null then
    raise exception 'Describe how the historical roster was verified' using errcode = '22023';
  end if;
  select count(*) into v_roster_count
  from public.attendance_event_roster
  where attendance_event_id = p_event_id and roster_state = 'included';
  if v_roster_count = 0 then
    raise exception 'Add the expected students before certifying the roster' using errcode = '22023';
  end if;
  update public.attendance_events
  set roster_certification_state = 'certified',
    roster_certified_at = now(),
    roster_certified_by_staff_id = p_actor_staff_id,
    roster_certification_note = v_note,
    updated_at = now()
  where id = p_event_id;
  return jsonb_build_object('eventId', p_event_id, 'certified', true, 'rosterCount', v_roster_count);
end;
$$;

create or replace function public.reopen_attendance_event(
  p_event_id uuid,
  p_actor_staff_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text;
begin
  perform 1 from public.attendance_events where id = p_event_id and lifecycle_state = 'completed' for update;
  if not found then
    raise exception 'Only a completed attendance event can be reopened' using errcode = '22023';
  end if;
  v_reason := nullif(left(trim(coalesce(p_reason, '')), 500), '');
  if v_reason is null then
    raise exception 'Give a reason for reopening this attendance event' using errcode = '22023';
  end if;
  insert into public.attendance_record_corrections (
    attendance_event_id, student_id, action, reason, previous_event, actor_staff_id
  )
  select id, null, 'event_reopened', v_reason,
    jsonb_build_object(
      'lifecycle_state', lifecycle_state,
      'completed_at', completed_at,
      'completed_by_staff_id', completed_by_staff_id,
      'completion_note', completion_note,
      'roster_certification_state', roster_certification_state,
      'roster_certified_at', roster_certified_at,
      'roster_certified_by_staff_id', roster_certified_by_staff_id,
      'roster_certification_note', roster_certification_note
    ),
    p_actor_staff_id
  from public.attendance_events where id = p_event_id;
  update public.attendance_events
  set lifecycle_state = 'open',
    completed_at = null,
    completed_by_staff_id = null,
    completion_note = 'Reopened for correction: ' || v_reason,
    correction_opened_at = now(),
    correction_opened_by_staff_id = p_actor_staff_id,
    correction_reason = v_reason,
    updated_at = now()
  where id = p_event_id;
  return jsonb_build_object('eventId', p_event_id, 'reopened', true, 'reason', v_reason);
end;
$$;

create or replace function public.correct_attendance_observation(
  p_event_id uuid,
  p_student_id uuid,
  p_actor_staff_id uuid,
  p_status text,
  p_note text,
  p_arrived_at timestamptz,
  p_departed_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.attendance_events%rowtype;
  v_previous jsonb;
  v_next jsonb;
begin
  select * into v_event from public.attendance_events where id = p_event_id for update;
  if not found then
    raise exception 'Attendance event not found' using errcode = 'P0002';
  end if;
  if v_event.lifecycle_state <> 'open' or v_event.correction_opened_at is null then
    raise exception 'Reopen the completed event before saving a correction' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.attendance_event_roster
    where attendance_event_id = p_event_id and student_id = p_student_id and roster_state = 'included'
  ) then
    raise exception 'Student is not in this event roster' using errcode = 'P0002';
  end if;
  select to_jsonb(observation) into v_previous
  from public.attendance_observations observation
  where observation.attendance_event_id = p_event_id and observation.portal_student_id = p_student_id;

  if p_status is null and p_note is null and p_arrived_at is null and p_departed_at is null then
    delete from public.attendance_observations
    where attendance_event_id = p_event_id and portal_student_id = p_student_id;
    v_next := null;
  else
    insert into public.attendance_observations (
      attendance_event_id, portal_student_id, status, note, arrived_at, departed_at, source, updated_at
    ) values (
      p_event_id, p_student_id, p_status, p_note, p_arrived_at, p_departed_at, 'attendance_web', now()
    )
    on conflict (attendance_event_id, portal_student_id) do update set
      status = excluded.status, note = excluded.note, arrived_at = excluded.arrived_at,
      departed_at = excluded.departed_at, source = excluded.source, updated_at = excluded.updated_at;
    select to_jsonb(observation) into v_next
    from public.attendance_observations observation
    where observation.attendance_event_id = p_event_id and observation.portal_student_id = p_student_id;
  end if;

  insert into public.attendance_observation_revisions (
    attendance_event_id, student_id, previous_observation, next_observation,
    correction_reason, actor_staff_id
  ) values (
    p_event_id, p_student_id, v_previous, v_next, v_event.correction_reason, p_actor_staff_id
  );
  return jsonb_build_object('eventId', p_event_id, 'studentId', p_student_id, 'corrected', true);
end;
$$;

create or replace function public.remove_attendance_event_student_with_records(
  p_event_id uuid,
  p_student_id uuid,
  p_actor_staff_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.attendance_events%rowtype;
  v_reason text;
  v_observation jsonb;
  v_exceptions jsonb;
begin
  select * into v_event from public.attendance_events where id = p_event_id for update;
  if not found then
    raise exception 'Attendance event not found' using errcode = 'P0002';
  end if;
  if v_event.lifecycle_state <> 'open' or v_event.roster_locked_at is null then
    raise exception 'Reopen and prepare the attendance event before correcting its roster' using errcode = '22023';
  end if;
  v_reason := nullif(left(trim(coalesce(p_reason, '')), 500), '');
  if v_reason is null then
    raise exception 'Give a reason for removing this student and saved records' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.attendance_event_roster
    where attendance_event_id = p_event_id and student_id = p_student_id and roster_state = 'included'
  ) then
    raise exception 'Student is not in this event roster' using errcode = 'P0002';
  end if;
  select to_jsonb(observation) into v_observation
  from public.attendance_observations observation
  where observation.attendance_event_id = p_event_id and observation.portal_student_id = p_student_id;
  select coalesce(jsonb_agg(to_jsonb(exception) order by exception.created_at), '[]'::jsonb)
    into v_exceptions
  from public.attendance_exceptions exception
  where exception.attendance_event_id = p_event_id and exception.portal_student_id = p_student_id;
  insert into public.attendance_record_corrections (
    attendance_event_id, student_id, action, reason,
    previous_observation, previous_exceptions, actor_staff_id
  ) values (
    p_event_id, p_student_id, 'student_removed_with_records', v_reason,
    v_observation, v_exceptions, p_actor_staff_id
  );
  delete from public.attendance_exceptions
  where attendance_event_id = p_event_id and portal_student_id = p_student_id;
  delete from public.attendance_observations
  where attendance_event_id = p_event_id and portal_student_id = p_student_id;
  update public.attendance_event_roster
  set roster_state = 'removed', basis = v_reason, source = 'staff_adjustment',
    reconstruction_quality = 'direct_adjustment', removed_at = now(),
    removed_by_staff_id = p_actor_staff_id, updated_at = now()
  where attendance_event_id = p_event_id and student_id = p_student_id;
  if v_event.roster_certification_state = 'certified' then
    update public.attendance_events
    set roster_certification_state = 'reconstructing',
      roster_certified_at = null,
      roster_certified_by_staff_id = null,
      roster_certification_note = null,
      updated_at = now()
    where id = p_event_id;
  end if;
  return jsonb_build_object('eventId', p_event_id, 'studentId', p_student_id, 'removed', true);
end;
$$;

create or replace function public.complete_attendance_event(
  p_event_id uuid,
  p_actor_staff_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.attendance_events%rowtype;
  v_roster_count integer;
  v_unmarked integer;
begin
  select * into v_event from public.attendance_events where id = p_event_id for update;
  if not found then
    raise exception 'Attendance event not found' using errcode = 'P0002';
  end if;
  if v_event.roster_locked_at is null or v_event.lifecycle_state <> 'open' then
    raise exception 'Only an open prepared event can be completed' using errcode = '22023';
  end if;
  if v_event.roster_certification_state <> 'certified' then
    raise exception 'Certify the expected roster before completing attendance' using errcode = '22023';
  end if;
  select count(*) into v_roster_count
  from public.attendance_event_roster
  where attendance_event_id = p_event_id and roster_state = 'included';
  if v_roster_count = 0 then
    raise exception 'An attendance event needs at least one expected student before completion'
      using errcode = '22023';
  end if;
  select count(*) into v_unmarked
  from public.attendance_event_roster roster
  left join public.attendance_observations observation
    on observation.attendance_event_id = roster.attendance_event_id
    and observation.portal_student_id = roster.student_id
  where roster.attendance_event_id = p_event_id
    and roster.roster_state = 'included'
    and (observation.portal_student_id is null or observation.status is null);
  if v_unmarked > 0 then
    raise exception 'Every expected student must be marked before completion' using errcode = '22023';
  end if;
  update public.attendance_events
  set lifecycle_state = 'completed',
    completed_at = now(),
    completed_by_staff_id = p_actor_staff_id,
    completion_note = nullif(left(trim(coalesce(p_note, '')), 500), ''),
    correction_opened_at = null,
    correction_opened_by_staff_id = null,
    correction_reason = null,
    updated_at = now()
  where id = p_event_id;
  return jsonb_build_object('eventId', p_event_id, 'completed', true, 'unmarkedCount', v_unmarked);
end;
$$;

revoke all on function public.adjust_attendance_event_roster(uuid,uuid,boolean,uuid,text)
  from public, anon, authenticated;
grant execute on function public.adjust_attendance_event_roster(uuid,uuid,boolean,uuid,text)
  to service_role;
revoke all on function public.complete_attendance_event(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.complete_attendance_event(uuid,uuid,text)
  to service_role;
revoke all on function public.begin_historical_attendance_reconstruction(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.begin_historical_attendance_reconstruction(uuid,uuid)
  to service_role;
revoke all on function public.certify_attendance_event_roster(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.certify_attendance_event_roster(uuid,uuid,text)
  to service_role;
revoke all on function public.reopen_attendance_event(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.reopen_attendance_event(uuid,uuid,text)
  to service_role;
revoke all on function public.remove_attendance_event_student_with_records(uuid,uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.remove_attendance_event_student_with_records(uuid,uuid,uuid,text)
  to service_role;
revoke all on function public.correct_attendance_observation(uuid,uuid,uuid,text,text,timestamptz,timestamptz)
  from public, anon, authenticated;
grant execute on function public.correct_attendance_observation(uuid,uuid,uuid,text,text,timestamptz,timestamptz)
  to service_role;

alter table public.attendance_calendar_groups enable row level security;
alter table public.attendance_event_roster enable row level security;
alter table public.attendance_event_roster_groups enable row level security;
alter table public.attendance_events enable row level security;
alter table public.attendance_observations enable row level security;
alter table public.attendance_exceptions enable row level security;
alter table public.attendance_staff_observations enable row level security;
alter table public.band_camp_attendance_2026 enable row level security;
alter table public.attendance_record_corrections enable row level security;
alter table public.attendance_observation_revisions enable row level security;

revoke all privileges on table public.attendance_calendar_groups from anon, authenticated;
revoke all privileges on table public.attendance_event_roster from anon, authenticated;
revoke all privileges on table public.attendance_event_roster_groups from anon, authenticated;
revoke all privileges on table public.attendance_events from anon, authenticated;
revoke all privileges on table public.attendance_observations from anon, authenticated;
revoke all privileges on table public.attendance_exceptions from anon, authenticated;
revoke all privileges on table public.attendance_staff_observations from anon, authenticated;
revoke all privileges on table public.band_camp_attendance_2026 from anon, authenticated;
revoke all privileges on table public.attendance_record_corrections from anon, authenticated;
revoke all privileges on table public.attendance_observation_revisions from anon, authenticated;

comment on table public.attendance_calendar_groups is
  'Reviewed mapping from a canonical calendar series to normalized program groups.';
comment on table public.attendance_event_roster is
  'Expected-student snapshot for one attendance occurrence. Missing observation means unmarked, never present.';
comment on column public.attendance_event_roster.reconstruction_quality is
  'Whether the row is a current preview, a locked membership snapshot, a direct adjustment, or incomplete historical evidence.';
comment on table public.attendance_record_corrections is
  'Recoverable snapshots of attendance evidence cleared during an explicit roster correction.';
comment on table public.attendance_observation_revisions is
  'Append-only before and after snapshots for student marks changed after a completed event is reopened.';

notify pgrst, 'reload schema';
