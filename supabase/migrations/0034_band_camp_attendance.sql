-- provenance: Student identity comes from portal_students, the website mirror of
-- BandsofAHS/data/students.csv. Attendance status is directly observed and entered
-- by authorized camp staff or student leadership through /attendance.

create table if not exists band_camp_attendance_2026 (
  attendance_date date not null,
  portal_student_id uuid not null references portal_students(id) on delete cascade,
  status text not null check (status in ('present', 'tardy', 'absent')),
  source text not null default 'attendance_web',
  updated_at timestamptz not null default now(),
  primary key (attendance_date, portal_student_id)
);

create index if not exists band_camp_attendance_2026_date_status_idx
  on band_camp_attendance_2026(attendance_date, status);

alter table band_camp_attendance_2026 enable row level security;

comment on table band_camp_attendance_2026 is
  'Event attendance observations; server-only access through audited attendance routes.';

notify pgrst, 'reload schema';
