-- Student-specific Open House / Band Ready progress. The JSON document keeps
-- the small checklist adaptable while the relational keys preserve family and
-- student ownership, completion, and email delivery history.
-- provenance: checklist answers are entered by a trusted family member in the
-- Family Portal; instrument and clothing completion are derived from existing
-- portal-owned request and payment records.

create table if not exists portal_band_ready_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references portal_students(id) on delete cascade,
  last_updated_by_person_id uuid references portal_people(id) on delete set null,
  progress jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  summary_email_sent_at timestamptz,
  summary_email_recipients jsonb not null default '[]'::jsonb,
  summary_email_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id)
);

create index if not exists portal_band_ready_progress_completion_idx
  on portal_band_ready_progress(completed_at, updated_at desc);

alter table portal_band_ready_progress enable row level security;

drop trigger if exists portal_band_ready_progress_updated_at on portal_band_ready_progress;
create trigger portal_band_ready_progress_updated_at
  before update on portal_band_ready_progress
  for each row execute function set_updated_at();

comment on table portal_band_ready_progress is
  'Family Portal Open House checklist progress, readiness needs, completion, and summary-email delivery state by student.';

notify pgrst, 'reload schema';
