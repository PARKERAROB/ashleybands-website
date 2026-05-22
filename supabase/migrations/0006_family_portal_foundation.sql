-- Ashley Bands Family Portal V1 — Phase 1 data foundation
-- CSV remains canonical. These tables are the website-accessible mirror plus
-- intake/review layer for profile access and staged updates.

create extension if not exists "pgcrypto";

-- ============ Sync audit ============

create table if not exists portal_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'bdos_csv',
  status text not null default 'running'
    check (status in ('running','completed','failed')),
  students_seen int not null default 0,
  people_seen int not null default 0,
  relationships_seen int not null default 0,
  contact_methods_seen int not null default 0,
  conflicts jsonb not null default '[]'::jsonb,
  notes text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- ============ Mirror identity model ============

create table if not exists portal_households (
  id uuid primary key default gen_random_uuid(),
  source_household_key text not null unique,
  display_name text not null,
  notes text,
  source text not null default 'bdos_csv',
  source_row_hash text,
  last_seen_sync_id uuid references portal_sync_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists portal_students (
  id uuid primary key default gen_random_uuid(),
  source_student_id text not null unique,
  legal_first text,
  legal_last text,
  preferred_first text,
  display_name text not null,
  grade_fall26 text,
  school_email text,
  cell_phone text,
  status text,
  notes text,
  source text not null default 'bdos_csv',
  source_row_hash text,
  last_seen_sync_id uuid references portal_sync_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists portal_people (
  id uuid primary key default gen_random_uuid(),
  source_person_key text not null unique,
  person_type text not null default 'guardian'
    check (person_type in ('guardian','student','staff','unknown')),
  display_name text not null,
  first_name text,
  last_name text,
  source text not null default 'bdos_csv',
  source_row_hash text,
  last_seen_sync_id uuid references portal_sync_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists portal_student_people (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references portal_students(id) on delete cascade,
  person_id uuid not null references portal_people(id) on delete cascade,
  household_id uuid references portal_households(id) on delete set null,
  role text,
  relationship_status text not null default 'trusted'
    check (relationship_status in ('trusted','claimed','rejected','superseded')),
  primary_contact boolean not null default false,
  source text not null default 'bdos_csv',
  source_row_hash text,
  last_seen_sync_id uuid references portal_sync_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, person_id)
);

create table if not exists portal_contact_methods (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references portal_people(id) on delete cascade,
  contact_type text not null check (contact_type in ('email','phone')),
  value_display text not null,
  value_normalized text not null,
  verification_status text not null default 'unverified'
    check (
      verification_status in (
        'unverified',
        'verified_magic_link',
        'verified_reply',
        'verified_one_click_response',
        'verified_manual',
        'hard_bounce',
        'replaced',
        'superseded'
      )
    ),
  verification_source text,
  verified_at timestamptz,
  verified_by text,
  evidence jsonb not null default '{}'::jsonb,
  source text not null default 'bdos_csv',
  source_row_hash text,
  last_seen_sync_id uuid references portal_sync_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, contact_type, value_normalized)
);

-- ============ Access and review layer ============

create table if not exists portal_magic_links (
  id uuid primary key default gen_random_uuid(),
  contact_method_id uuid references portal_contact_methods(id) on delete cascade,
  access_request_id uuid,
  token_hash text not null unique,
  purpose text not null check (purpose in ('known_contact_login','unknown_email_confirm')),
  email text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  ip_created text,
  user_agent_created text,
  ip_consumed text,
  user_agent_consumed text,
  created_at timestamptz not null default now()
);

create table if not exists portal_access_requests (
  id uuid primary key default gen_random_uuid(),
  guardian_name text not null,
  guardian_email text not null,
  guardian_phone text,
  student_first text not null,
  student_last text not null,
  student_grade text,
  instrument_or_note text,
  email_verified_at timestamptz,
  claimed_student_id uuid references portal_students(id) on delete set null,
  claimed_person_id uuid references portal_people(id) on delete set null,
  match_confidence text check (match_confidence in ('none','possible','likely','exact') or match_confidence is null),
  status text not null default 'new'
    check (status in ('new','email_verified','needs_review','approved','rejected','merged','needs_followup')),
  review_item_id uuid,
  ip_created text,
  user_agent_created text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'portal_magic_links_access_request_fk'
  ) then
    alter table portal_magic_links
      add constraint portal_magic_links_access_request_fk
      foreign key (access_request_id) references portal_access_requests(id) on delete cascade;
  end if;
end $$;

create table if not exists portal_update_requests (
  id uuid primary key default gen_random_uuid(),
  submitted_by_person_id uuid references portal_people(id) on delete set null,
  student_id uuid references portal_students(id) on delete set null,
  target_table text not null,
  target_id uuid,
  field_name text not null,
  old_value text,
  new_value text not null,
  sensitivity text not null default 'normal'
    check (sensitivity in ('normal','contact','relationship','medical','financial','internal')),
  status text not null default 'new'
    check (status in ('new','needs_review','approved','rejected','merged','needs_followup')),
  review_item_id uuid,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  review_notes text
);

create table if not exists portal_review_queue (
  id uuid primary key default gen_random_uuid(),
  item_type text not null
    check (
      item_type in (
        'unknown_email_access',
        'guardian_claim',
        'email_verified_claim',
        'profile_conflict',
        'contact_change',
        'sibling_suggestion',
        'hard_bounce',
        'duplicate_match',
        'sensitive_submission'
      )
    ),
  status text not null default 'new'
    check (status in ('new','email_verified','needs_review','approved','rejected','merged','needs_followup')),
  student_id uuid references portal_students(id) on delete set null,
  person_id uuid references portal_people(id) on delete set null,
  access_request_id uuid references portal_access_requests(id) on delete set null,
  update_request_id uuid references portal_update_requests(id) on delete set null,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  email_alert_status text not null default 'pending'
    check (email_alert_status in ('pending','sent','failed','skipped')),
  email_alert_sent_at timestamptz,
  email_alert_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'portal_access_requests_review_item_fk'
  ) then
    alter table portal_access_requests
      add constraint portal_access_requests_review_item_fk
      foreign key (review_item_id) references portal_review_queue(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'portal_update_requests_review_item_fk'
  ) then
    alter table portal_update_requests
      add constraint portal_update_requests_review_item_fk
      foreign key (review_item_id) references portal_review_queue(id) on delete set null;
  end if;
end $$;

-- ============ Indexes and views ============

create index if not exists portal_students_name_idx on portal_students(lower(legal_last), lower(legal_first));
create index if not exists portal_students_status_idx on portal_students(status);
create index if not exists portal_people_name_idx on portal_people(lower(display_name));
create index if not exists portal_student_people_student_idx on portal_student_people(student_id);
create index if not exists portal_student_people_person_idx on portal_student_people(person_id);
create index if not exists portal_contact_methods_lookup_idx on portal_contact_methods(contact_type, value_normalized);
create index if not exists portal_magic_links_token_idx on portal_magic_links(token_hash);
create index if not exists portal_review_queue_status_idx on portal_review_queue(status, created_at);

create or replace view portal_mirror_counts as
select 'students' as entity, count(*)::int as row_count from portal_students
union all
select 'people', count(*)::int from portal_people
union all
select 'student_people', count(*)::int from portal_student_people
union all
select 'contact_methods', count(*)::int from portal_contact_methods
union all
select 'review_queue_open', count(*)::int from portal_review_queue
 where status in ('new','email_verified','needs_review','needs_followup');

-- ============ Helper for updated_at ============

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists portal_households_updated_at on portal_households;
create trigger portal_households_updated_at
  before update on portal_households
  for each row execute function set_updated_at();

drop trigger if exists portal_students_updated_at on portal_students;
create trigger portal_students_updated_at
  before update on portal_students
  for each row execute function set_updated_at();

drop trigger if exists portal_people_updated_at on portal_people;
create trigger portal_people_updated_at
  before update on portal_people
  for each row execute function set_updated_at();

drop trigger if exists portal_student_people_updated_at on portal_student_people;
create trigger portal_student_people_updated_at
  before update on portal_student_people
  for each row execute function set_updated_at();

drop trigger if exists portal_contact_methods_updated_at on portal_contact_methods;
create trigger portal_contact_methods_updated_at
  before update on portal_contact_methods
  for each row execute function set_updated_at();

drop trigger if exists portal_access_requests_updated_at on portal_access_requests;
create trigger portal_access_requests_updated_at
  before update on portal_access_requests
  for each row execute function set_updated_at();

drop trigger if exists portal_review_queue_updated_at on portal_review_queue;
create trigger portal_review_queue_updated_at
  before update on portal_review_queue
  for each row execute function set_updated_at();

-- ============ RLS ============
-- Browser code must not query these tables directly in V1. API routes and local
-- scripts use SUPABASE_SECRET_KEY and enforce portal access rules server-side.

alter table portal_sync_runs enable row level security;
alter table portal_households enable row level security;
alter table portal_students enable row level security;
alter table portal_people enable row level security;
alter table portal_student_people enable row level security;
alter table portal_contact_methods enable row level security;
alter table portal_magic_links enable row level security;
alter table portal_access_requests enable row level security;
alter table portal_update_requests enable row level security;
alter table portal_review_queue enable row level security;
