-- provenance: Event snapshots come from the website projection of canonical
-- BandsofAHS/data/calendar-events.jsonl. Planned exceptions are approved by an
-- authenticated staff member. Observations are entered by authorized staff or
-- student leadership through /attendance. Student identity remains a reference
-- to portal_students and is not copied into these tables.

create extension if not exists "pgcrypto";

create table if not exists attendance_events (
  id uuid primary key default gen_random_uuid(),
  occurrence_key text not null unique,
  calendar_event_id text not null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  source text not null default 'calendar_projection',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists attendance_events_starts_at_idx
  on attendance_events(starts_at);

create table if not exists attendance_observations (
  attendance_event_id uuid not null references attendance_events(id) on delete restrict,
  portal_student_id uuid not null references portal_students(id) on delete cascade,
  status text check (status in ('present', 'tardy', 'absent')),
  note text check (note is null or char_length(note) <= 1000),
  arrived_at timestamptz,
  departed_at timestamptz,
  source text not null default 'attendance_web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (attendance_event_id, portal_student_id),
  check (status is not null or note is not null or arrived_at is not null or departed_at is not null)
);

create index if not exists attendance_observations_event_status_idx
  on attendance_observations(attendance_event_id, status);

create table if not exists attendance_exceptions (
  id uuid primary key default gen_random_uuid(),
  attendance_event_id uuid not null references attendance_events(id) on delete restrict,
  portal_student_id uuid not null references portal_students(id) on delete cascade,
  kind text not null check (kind in ('absent', 'late_arrival', 'early_departure')),
  expected_at timestamptz,
  note text check (note is null or char_length(note) <= 1000),
  approval_state text not null default 'approved'
    check (approval_state in ('pending', 'approved', 'rejected')),
  approved_by_staff_id uuid references staff(id) on delete set null,
  approved_at timestamptz,
  source text not null default 'attendance_staff',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attendance_event_id, portal_student_id, kind),
  check (approval_state <> 'approved' or (approved_by_staff_id is not null and approved_at is not null))
);

create index if not exists attendance_exceptions_event_approval_idx
  on attendance_exceptions(attendance_event_id, approval_state);

alter table attendance_events enable row level security;
alter table attendance_observations enable row level security;
alter table attendance_exceptions enable row level security;

comment on table attendance_events is
  'Stable snapshots of attendance-enabled canonical calendar occurrences.';
comment on table attendance_observations is
  'Observed attendance facts, kept separately for each event occurrence.';
comment on table attendance_exceptions is
  'Planned attendance exceptions approved by authenticated staff; never observations.';
comment on column attendance_observations.departed_at is
  'Actual observed departure time; independent of present/tardy/absent status.';
comment on column attendance_exceptions.expected_at is
  'Planned arrival or departure time, not proof the event occurred.';

insert into attendance_events (
  occurrence_key,
  calendar_event_id,
  title,
  starts_at,
  ends_at,
  source
) values (
  'evt-0007:2026-08-03',
  'evt-0007',
  'Band Camp (week 1)',
  '2026-08-03T07:00:00-04:00',
  '2026-08-03T15:00:00-04:00',
  'calendar_projection'
) on conflict (occurrence_key) do nothing;

insert into attendance_observations (
  attendance_event_id,
  portal_student_id,
  status,
  note,
  source,
  updated_at
)
select
  event.id,
  legacy.portal_student_id,
  legacy.status,
  legacy.note,
  legacy.source,
  legacy.updated_at
from band_camp_attendance_2026 legacy
cross join attendance_events event
where legacy.attendance_date = '2026-08-03'
  and event.occurrence_key = 'evt-0007:2026-08-03'
on conflict (attendance_event_id, portal_student_id) do nothing;

do $$
declare
  legacy_count integer;
  migrated_count integer;
  legacy_status_counts jsonb;
  migrated_status_counts jsonb;
  legacy_note_count integer;
  migrated_note_count integer;
begin
  select count(*), count(*) filter (where nullif(btrim(note), '') is not null)
    into legacy_count, legacy_note_count
    from band_camp_attendance_2026
   where attendance_date = '2026-08-03';

  select count(*), count(*) filter (where nullif(btrim(observation.note), '') is not null)
    into migrated_count, migrated_note_count
    from attendance_observations observation
    join attendance_events event on event.id = observation.attendance_event_id
   where event.occurrence_key = 'evt-0007:2026-08-03';

  select coalesce(jsonb_object_agg(status_key, status_count), '{}'::jsonb)
    into legacy_status_counts
    from (
      select coalesce(status, 'unmarked') status_key, count(*) status_count
        from band_camp_attendance_2026
       where attendance_date = '2026-08-03'
       group by status
    ) counts;

  select coalesce(jsonb_object_agg(status_key, status_count), '{}'::jsonb)
    into migrated_status_counts
    from (
      select coalesce(observation.status, 'unmarked') status_key, count(*) status_count
        from attendance_observations observation
        join attendance_events event on event.id = observation.attendance_event_id
       where event.occurrence_key = 'evt-0007:2026-08-03'
       group by observation.status
    ) counts;

  if legacy_count <> migrated_count
    or legacy_note_count <> migrated_note_count
    or legacy_status_counts <> migrated_status_counts then
    raise exception
      'Day 1 attendance migration mismatch: old rows %, new rows %, old statuses %, new statuses %, old notes %, new notes %',
      legacy_count, migrated_count, legacy_status_counts, migrated_status_counts,
      legacy_note_count, migrated_note_count;
  end if;
end $$;

notify pgrst, 'reload schema';
