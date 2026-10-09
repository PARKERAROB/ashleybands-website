-- provenance: Bus marks are direct trip observations entered by chaperones
-- (shared attendance PIN) or staff through /attendance/bus (#197). Students
-- come from the attendance event roster (portal_students, projected from the
-- BandsofAHS roster). One row per event, student and trip leg; no row means
-- the student is not yet accounted for on that leg.

create table if not exists attendance_bus_checks (
  attendance_event_id uuid not null references attendance_events(id) on delete restrict,
  portal_student_id uuid not null references portal_students(id) on delete cascade,
  leg text not null check (leg in ('to_venue', 'return')),
  ride text not null check (ride ~ '^bus_[1-9]$' or ride in ('own_ride', 'not_traveling')),
  source text not null default 'attendance_web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (attendance_event_id, portal_student_id, leg)
);

alter table attendance_bus_checks enable row level security;
revoke all privileges on table public.attendance_bus_checks from anon, authenticated;
grant all on table public.attendance_bus_checks to service_role;

comment on table attendance_bus_checks is
  'Trip bus accountability per attendance event, student and leg. Separate from the attendance record.';
comment on column attendance_bus_checks.ride is
  'bus_N when the student is on bus N, own_ride when riding with a parent, not_traveling when not on this leg.';

notify pgrst, 'reload schema';
