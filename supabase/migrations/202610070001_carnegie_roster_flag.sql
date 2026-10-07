-- #187: staff mark each student "Carnegie: yes / no"; the staff sheet counts the yes rows.
-- provenance: set only by staff on /admin/carnegie-2027 (audited PATCH) or a staff-authorized import; never family-entered.
-- Default false: every existing row reads "no" until staff set it.
-- Table access is unchanged: RLS on, no anon/authenticated privileges (service role only).

alter table public.carnegie_trip_staff_tracking
  add column if not exists carnegie_roster boolean not null default false;

comment on column public.carnegie_trip_staff_tracking.carnegie_roster is
  'Staff-only Carnegie trip roster flag (yes/no). Never shown to families.';
