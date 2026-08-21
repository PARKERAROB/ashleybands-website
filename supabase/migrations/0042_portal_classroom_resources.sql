-- Authenticated classroom resource assignments and student self-access support.
-- provenance: locker, matched lock, and tuner values are projected from the
-- BandsofAHS canonical CSV homes; requester role and instrument identification
-- are entered by the verified portal user who owns the active session.

alter table public.portal_access_requests
  add column if not exists requester_type text not null default 'guardian'
    check (requester_type in ('guardian', 'student'));

create table if not exists public.portal_student_resources (
  student_id uuid primary key references public.portal_students(id) on delete cascade,
  locker_number text,
  lock_serial text,
  lock_combination text,
  tuner_number text,
  tuner_shared_with text,
  assignment_status text not null default 'provisional'
    check (assignment_status in ('provisional', 'verified', 'returned')),
  source text not null default 'bandsofahs_resource_csv',
  source_row_hash text not null,
  last_seen_sync_id uuid references public.portal_sync_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.portal_student_resources enable row level security;

drop trigger if exists portal_student_resources_updated_at on public.portal_student_resources;
create trigger portal_student_resources_updated_at
  before update on public.portal_student_resources
  for each row execute function set_updated_at();

comment on table public.portal_student_resources is
  'Authenticated student locker, matched lock, and tuner projection from BandsofAHS canonical resource CSV files.';
comment on column public.portal_student_resources.lock_serial is
  'Full serial retained so the serial/combination pair cannot be separated; family UI displays only the final three-digit lock ID.';

alter table public.instrument_inventory
  add column if not exists source text not null default 'legacy_public_intake',
  add column if not exists submitted_by_person_id uuid references public.portal_people(id) on delete set null;

comment on column public.instrument_inventory.source is
  'Provenance for the observation or issued-instrument identification, including portal_student_issue for authenticated student entries.';
comment on column public.instrument_inventory.submitted_by_person_id is
  'Verified portal person who entered the instrument identification; null for legacy public intake.';

create or replace view public.portal_mirror_counts as
select 'students' as entity, count(*)::int as row_count from public.portal_students
union all
select 'people', count(*)::int from public.portal_people
union all
select 'student_people', count(*)::int from public.portal_student_people
union all
select 'contact_methods', count(*)::int from public.portal_contact_methods
union all
select 'student_resources', count(*)::int from public.portal_student_resources
union all
select 'review_queue_open', count(*)::int from public.portal_review_queue
 where status in ('new','email_verified','needs_review','needs_followup');

notify pgrst, 'reload schema';
