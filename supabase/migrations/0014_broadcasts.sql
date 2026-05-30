-- Ashley Bands — Communication layer (Phase 1).
-- A broadcast is an email Rob composes, targets via an attribute-segment filter,
-- and sends through Resend on the band domain — independent of NHCS Google/Microsoft.
-- Three pieces:
--   portal_student_attributes — flexible EAV tags on a student (instrument, ensemble,
--     leadership, lane, grad_year, alumni, ...). The audience picker is GENERATED from
--     whatever keys/values exist here, so new "viewpoints" are additive with no migration.
--   broadcasts            — one composed message + its audience filter + status.
--   broadcast_recipients  — the resolved recipient list + per-send status (the send log).
-- Browser code must NOT query these directly; API routes use SUPABASE_SECRET_KEY and
-- enforce staff access server-side. L2: Rob is the only sender — nothing here auto-sends.

create extension if not exists "pgcrypto";

-- ============ Flexible student attributes (EAV) ============
-- One row per (student, key, value). Multi-value keys are allowed (e.g. a student in
-- several ensembles = several rows with key='ensemble'). The unique constraint dedupes.

create table if not exists portal_student_attributes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references portal_students(id) on delete cascade,
  key text not null,
  value text not null,
  source text not null default 'manual'
    check (source in ('manual','bulk','bdos_csv','sync')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, key, value)
);

create index if not exists portal_student_attributes_student_idx
  on portal_student_attributes(student_id);
-- Drives both the audience resolver (match a key/value) and the picker (distinct keys/values).
create index if not exists portal_student_attributes_key_value_idx
  on portal_student_attributes(key, value);

-- ============ Broadcasts (one composed message) ============

create table if not exists broadcasts (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body_html text not null default '',
  -- The segment spec the composer built (predicates over attribute key/values with
  -- AND/OR/NOT + group unions). Resolver in lib/audience.js interprets this.
  audience_filter jsonb not null default '{}'::jsonb,
  -- Whose inbox the matched students expand to.
  recipient_axis text not null default 'guardians'
    check (recipient_axis in ('students','guardians','both')),
  status text not null default 'draft'
    check (status in ('draft','sending','sent','failed')),
  created_by text not null default '',
  recipient_count integer not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists broadcasts_status_idx on broadcasts(status);
create index if not exists broadcasts_created_idx on broadcasts(created_at desc);

-- ============ Broadcast recipients (resolved list + send log) ============
-- One row per email a broadcast goes to. student_id = the student this recipient relates
-- to (or the student themselves). person_id = the guardian/person, null when the recipient
-- is the student's own school email. send_status tracks Resend dispatch per recipient.

create table if not exists broadcast_recipients (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references broadcasts(id) on delete cascade,
  student_id uuid references portal_students(id) on delete set null,
  person_id uuid references portal_people(id) on delete set null,
  email text not null,
  send_status text not null default 'queued'
    check (send_status in ('queued','sent','failed','skipped')),
  send_error text not null default '',
  resend_id text not null default '',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  -- Dedupe: a broadcast hits any given address at most once.
  unique (broadcast_id, email)
);

create index if not exists broadcast_recipients_broadcast_idx
  on broadcast_recipients(broadcast_id);
create index if not exists broadcast_recipients_status_idx
  on broadcast_recipients(broadcast_id, send_status);

-- ============ updated_at triggers (reuses set_updated_at from 0001) ============

drop trigger if exists portal_student_attributes_updated_at on portal_student_attributes;
create trigger portal_student_attributes_updated_at
  before update on portal_student_attributes
  for each row execute function set_updated_at();

drop trigger if exists broadcasts_updated_at on broadcasts;
create trigger broadcasts_updated_at
  before update on broadcasts
  for each row execute function set_updated_at();

-- ============ RLS ============
-- API routes use SUPABASE_SECRET_KEY (bypasses RLS) and enforce staff access server-side.

alter table portal_student_attributes enable row level security;
alter table broadcasts enable row level security;
alter table broadcast_recipients enable row level security;

notify pgrst, 'reload schema';
