-- Family-submitted NHCS instrument responsibility agreement, followed by
-- teacher assignment of the specific instrument.

create table if not exists portal_instrument_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references portal_students(id) on delete cascade,
  submitted_by_person_id uuid not null references portal_people(id) on delete restrict,
  school_year text not null,
  student_signature text not null,
  guardian_signature text not null,
  agreement_version text not null default 'nhcs_checkout_2026_27_v1',
  source text not null default 'portal_family',
  responsibility_accepted boolean not null default false,
  status text not null default 'submitted'
    check (status in ('submitted','assigned','returned','cancelled')),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, school_year)
);

create index if not exists portal_instrument_requests_status_idx
  on portal_instrument_requests(status, submitted_at);

-- Assignment lives with the inventory record. The signed agreement merely
-- makes the student eligible to appear in the inventory assignment picker.
alter table public.instrument_inventory
  add column if not exists assigned_student_id uuid references portal_students(id) on delete set null,
  add column if not exists instrument_request_id uuid references portal_instrument_requests(id) on delete set null,
  add column if not exists issued_at timestamptz,
  add column if not exists issued_by text not null default '',
  add column if not exists issued_condition text not null default '',
  add column if not exists assignment_notes text not null default '';

create unique index if not exists instrument_inventory_active_request_idx
  on public.instrument_inventory(instrument_request_id)
  where instrument_request_id is not null;
