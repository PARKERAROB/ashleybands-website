-- provenance: Staff attendance is a direct per-session observation entered by
-- authorized Ashley Bands staff or student leadership through /attendance.
-- Staff account identity is referenced from public.staff when available; an
-- event-only display name supports operational staff who do not need a login.

create table if not exists attendance_staff_observations (
  id uuid primary key default gen_random_uuid(),
  attendance_event_id uuid not null references attendance_events(id) on delete restrict,
  staff_id uuid references staff(id) on delete set null,
  display_name text not null check (
    char_length(btrim(display_name)) between 1 and 120
  ),
  status text check (status in ('present', 'absent', 'late', 'left_early')),
  arrived_at timestamptz,
  departed_at timestamptz,
  role_assignment text check (
    role_assignment is null or char_length(role_assignment) <= 160
  ),
  work_notes text check (
    work_notes is null or char_length(work_notes) <= 500
  ),
  source text not null default 'attendance_web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists attendance_staff_observations_event_staff_idx
  on attendance_staff_observations(attendance_event_id, staff_id)
  where staff_id is not null;

create unique index if not exists attendance_staff_observations_event_name_idx
  on attendance_staff_observations(attendance_event_id, lower(btrim(display_name)));

create index if not exists attendance_staff_observations_event_status_idx
  on attendance_staff_observations(attendance_event_id, status);

alter table attendance_staff_observations enable row level security;

comment on table attendance_staff_observations is
  'Staff attendance and event work details stored independently for each attendance session.';
comment on column attendance_staff_observations.status is
  'Observed staff state: present, absent, late, or left early.';
comment on column attendance_staff_observations.role_assignment is
  'The staff member role or assignment for this event occurrence.';
comment on column attendance_staff_observations.work_notes is
  'Short work notes for this event occurrence; not a standing personnel record.';

notify pgrst, 'reload schema';
