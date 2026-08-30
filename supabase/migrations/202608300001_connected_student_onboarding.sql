-- Connected student onboarding and current-profile records.
-- provenance: accepted AshleyBands onboarding prototype and the private current
-- roster projection documented in BandsofAHS/projects/website-full-op-2026.
-- The database stores connected facts, not a duplicate permanent answer blob.

create table if not exists portal_schools (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  city text,
  state text,
  district text,
  school_level text,
  active boolean not null default true,
  source text not null default 'staff_directory',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into portal_schools (code, name, city, state, district, school_level, source)
values
  ('ashley-high', 'Eugene Ashley High School', 'Wilmington', 'NC', 'New Hanover County Schools', 'high', 'staff_directory'),
  ('murray-middle', 'Charles P. Murray Middle', 'Wilmington', 'NC', 'New Hanover County Schools', 'middle', 'staff_directory'),
  ('myrtle-grove-middle', 'Myrtle Grove Middle', 'Wilmington', 'NC', 'New Hanover County Schools', 'middle', 'staff_directory'),
  ('holly-shelter-middle', 'Holly Shelter Middle', 'Castle Hayne', 'NC', 'New Hanover County Schools', 'middle', 'staff_directory'),
  ('noble-middle', 'MCS Noble Middle', 'Wilmington', 'NC', 'New Hanover County Schools', 'middle', 'staff_directory'),
  ('roland-grise-middle', 'Roland-Grise Middle', 'Wilmington', 'NC', 'New Hanover County Schools', 'middle', 'staff_directory'),
  ('trask-middle', 'Emma B. Trask Middle', 'Wilmington', 'NC', 'New Hanover County Schools', 'middle', 'staff_directory'),
  ('williston-middle', 'Williston Middle', 'Wilmington', 'NC', 'New Hanover County Schools', 'middle', 'staff_directory')
on conflict (code) do update set
  name = excluded.name,
  city = excluded.city,
  state = excluded.state,
  district = excluded.district,
  school_level = excluded.school_level,
  active = true,
  updated_at = now();

create table if not exists portal_instrument_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into portal_instrument_types (code, name, sort_order)
values
  ('flute', 'Flute', 10), ('oboe', 'Oboe', 20), ('bassoon', 'Bassoon', 30),
  ('clarinet', 'Clarinet', 40), ('bass-clarinet', 'Bass Clarinet', 50),
  ('alto-saxophone', 'Alto Saxophone', 60), ('tenor-saxophone', 'Tenor Saxophone', 70),
  ('baritone-saxophone', 'Baritone Saxophone', 80), ('trumpet', 'Trumpet', 90),
  ('french-horn', 'French Horn', 100), ('trombone', 'Trombone', 110),
  ('euphonium', 'Euphonium', 120), ('tuba', 'Tuba', 130),
  ('percussion', 'Percussion', 140), ('guitar', 'Guitar', 150),
  ('bass-guitar', 'Bass Guitar', 160), ('piano', 'Piano', 170)
on conflict (code) do update set name = excluded.name, sort_order = excluded.sort_order, active = true;

create table if not exists portal_interest_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into portal_interest_types (code, name, sort_order)
values
  ('concert-band', 'Concert Band', 10), ('wind-ensemble', 'Wind Ensemble', 20),
  ('marching-band', 'Marching Band', 30), ('color-guard', 'Color Guard', 40),
  ('jazz', 'Jazz', 50), ('percussion', 'Percussion', 60),
  ('leadership', 'Leadership', 70), ('solo-ensemble', 'Solo and Ensemble', 80)
on conflict (code) do update set name = excluded.name, sort_order = excluded.sort_order, active = true;

create table if not exists portal_student_profiles (
  student_id uuid primary key references portal_students(id) on delete cascade,
  name_pronunciation text,
  pronouns text,
  source text not null default 'portal_self_edit',
  updated_by_person_id uuid references portal_people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists portal_student_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references portal_students(id) on delete cascade,
  school_id uuid not null references portal_schools(id) on delete restrict,
  school_year text not null,
  grade text,
  starts_on date,
  ends_on date,
  source text not null,
  source_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists portal_student_enrollments_one_current_idx
  on portal_student_enrollments (student_id) where ends_on is null;
create index if not exists portal_student_enrollments_school_idx
  on portal_student_enrollments (school_id, school_year) where ends_on is null;

insert into portal_student_enrollments (student_id, school_id, school_year, grade, source, source_reference)
select s.id, school.id, '2026-27', s.grade_fall26, 'bdos_csv_projection', 'grade_fall26 implies Ashley High for grades 9-12'
from portal_students s
cross join portal_schools school
where school.code = 'ashley-high'
  and lower(coalesce(s.status, '')) = 'active'
  and s.grade_fall26 in ('9', '10', '11', '12')
  and not exists (
    select 1 from portal_student_enrollments enrollment
    where enrollment.student_id = s.id and enrollment.ends_on is null
  );

create table if not exists portal_student_music_profiles (
  student_id uuid primary key references portal_students(id) on delete cascade,
  primary_instrument_id uuid references portal_instrument_types(id) on delete restrict,
  primary_instrument_none boolean not null default false,
  years_playing text,
  instrument_access text not null default 'not_sure'
    check (instrument_access in ('personal', 'school', 'percussion', 'not_sure')),
  source text not null default 'portal_self_edit',
  updated_by_person_id uuid references portal_people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not (primary_instrument_none and primary_instrument_id is not null))
);

create table if not exists portal_student_other_instruments (
  student_id uuid not null references portal_students(id) on delete cascade,
  instrument_type_id uuid not null references portal_instrument_types(id) on delete restrict,
  source text not null default 'portal_self_edit',
  created_at timestamptz not null default now(),
  primary key (student_id, instrument_type_id)
);

create table if not exists portal_student_interests (
  student_id uuid not null references portal_students(id) on delete cascade,
  interest_type_id uuid not null references portal_interest_types(id) on delete restrict,
  source text not null default 'portal_self_edit',
  created_at timestamptz not null default now(),
  primary key (student_id, interest_type_id)
);

create table if not exists portal_student_school_background (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references portal_students(id) on delete cascade,
  school_id uuid references portal_schools(id) on delete restrict,
  external_school_name text,
  external_city text,
  external_state text,
  no_previous_music_program boolean not null default false,
  source text not null default 'portal_self_edit',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id),
  check (
    school_id is not null
    or no_previous_music_program
    or (external_school_name is not null and external_city is not null and external_state is not null)
  )
);

create table if not exists portal_support_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references portal_students(id) on delete cascade,
  submitted_by_person_id uuid references portal_people(id) on delete set null,
  areas text[] not null default '{}',
  note text,
  status text not null default 'open' check (status in ('open', 'resolved', 'closed_no_action')),
  resolution_note text,
  resolved_at timestamptz,
  resolved_by text,
  source text not null default 'portal_onboarding',
  form_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(areas) > 0 or note is not null)
);
create index if not exists portal_support_requests_open_idx
  on portal_support_requests (student_id, created_at desc) where status = 'open';
create unique index if not exists portal_support_requests_one_onboarding_open_idx
  on portal_support_requests (student_id, source)
  where status = 'open' and source = 'portal_onboarding';

create table if not exists portal_student_status_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references portal_students(id) on delete cascade,
  from_status text,
  to_status text not null,
  reason text,
  effective_at timestamptz not null default now(),
  changed_by text,
  source text not null,
  created_at timestamptz not null default now()
);
create index if not exists portal_student_status_events_student_idx
  on portal_student_status_events (student_id, effective_at desc);

insert into portal_student_status_events (student_id, to_status, reason, source)
select student.id, coalesce(nullif(student.status, ''), 'unknown'), 'Initial current-status snapshot', 'bdos_csv_projection'
from portal_students student
where not exists (
  select 1 from portal_student_status_events event where event.student_id = student.id
);

create table if not exists portal_onboarding_completions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references portal_students(id) on delete cascade,
  form_version text not null,
  submitted_by_person_id uuid references portal_people(id) on delete set null,
  first_submitted_at timestamptz not null default now(),
  last_confirmed_at timestamptz not null default now(),
  confirmed_accurate boolean not null default true,
  revision int not null default 1,
  source text not null default 'portal_onboarding',
  unique (student_id, form_version)
);

alter table portal_student_people
  add column if not exists emergency_contact boolean not null default false;

alter table portal_student_people
  add column if not exists assurance_level text not null default 'legacy'
  check (assurance_level in ('legacy', 'medium', 'high'));
alter table portal_student_people
  add column if not exists trust_source text;
alter table portal_student_people
  add column if not exists assured_at timestamptz;
alter table portal_student_people
  add column if not exists assured_by text;

update portal_student_people
set
  assurance_level = case
    when source in ('bdos_students_csv', 'bdos_parents_csv', 'bdos_roster_seed', 'nhcs_sis_roster_2026_08_17', 'manual') then 'high'
    when source = 'portal_self_add' then 'medium'
    else 'legacy'
  end,
  trust_source = case
    when source = 'bdos_students_csv' or role = 'student' then 'canonical_student_record'
    when source in ('bdos_parents_csv', 'bdos_roster_seed', 'nhcs_sis_roster_2026_08_17') then 'existing_guardian_contact'
    when source = 'manual' then 'staff_grant'
    when source = 'portal_self_add' then 'trusted_guardian_add'
    else 'legacy_name_match'
  end,
  assured_at = case
    when source in ('bdos_students_csv', 'bdos_parents_csv', 'bdos_roster_seed', 'nhcs_sis_roster_2026_08_17', 'manual', 'portal_self_add')
      then coalesce(updated_at, created_at)
    else null
  end,
  assured_by = case when source = 'manual' then 'staff' else source end;

alter table portal_access_requests
  add column if not exists student_school_email text;

alter table audit_log drop constraint if exists audit_log_actor_type_check;
alter table audit_log add constraint audit_log_actor_type_check
  check (actor_type in ('staff', 'parent', 'student', 'system'));

alter table portal_contact_methods
  add column if not exists contact_purpose text not null default 'general'
  check (contact_purpose in ('general', 'school', 'personal_backup', 'emergency_mobile'));

create index if not exists portal_contact_methods_purpose_idx
  on portal_contact_methods (person_id, contact_purpose)
  where verification_status not in ('replaced', 'superseded');

create table if not exists portal_onboarding_progress (
  student_id uuid not null references portal_students(id) on delete cascade,
  form_version text not null,
  last_completed_step int not null default 0 check (last_completed_step between 0 and 6),
  completion_status text not null default 'in_progress'
    check (completion_status in ('in_progress', 'complete')),
  updated_by_person_id uuid references portal_people(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (student_id, form_version)
);

create table if not exists portal_onboarding_step_receipts (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  student_id uuid not null references portal_students(id) on delete cascade,
  form_version text not null,
  step_number int not null check (step_number between 1 and 6),
  submitted_by_person_id uuid references portal_people(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table portal_student_measurements
  add column if not exists shirt_size_source text;
alter table portal_student_measurements
  add column if not exists shirt_size_updated_at timestamptz;
alter table portal_student_measurements
  add column if not exists shirt_size_updated_by_person_id uuid references portal_people(id) on delete set null;

drop trigger if exists portal_schools_updated_at on portal_schools;
create trigger portal_schools_updated_at before update on portal_schools
  for each row execute function set_updated_at();
drop trigger if exists portal_student_profiles_updated_at on portal_student_profiles;
create trigger portal_student_profiles_updated_at before update on portal_student_profiles
  for each row execute function set_updated_at();
drop trigger if exists portal_student_enrollments_updated_at on portal_student_enrollments;
create trigger portal_student_enrollments_updated_at before update on portal_student_enrollments
  for each row execute function set_updated_at();
drop trigger if exists portal_student_music_profiles_updated_at on portal_student_music_profiles;
create trigger portal_student_music_profiles_updated_at before update on portal_student_music_profiles
  for each row execute function set_updated_at();
drop trigger if exists portal_student_school_background_updated_at on portal_student_school_background;
create trigger portal_student_school_background_updated_at before update on portal_student_school_background
  for each row execute function set_updated_at();
drop trigger if exists portal_support_requests_updated_at on portal_support_requests;
create trigger portal_support_requests_updated_at before update on portal_support_requests
  for each row execute function set_updated_at();
drop trigger if exists portal_onboarding_progress_updated_at on portal_onboarding_progress;
create trigger portal_onboarding_progress_updated_at before update on portal_onboarding_progress
  for each row execute function set_updated_at();

alter table public.portal_schools enable row level security;
alter table public.portal_instrument_types enable row level security;
alter table public.portal_interest_types enable row level security;
alter table public.portal_student_profiles enable row level security;
alter table public.portal_student_enrollments enable row level security;
alter table public.portal_student_music_profiles enable row level security;
alter table public.portal_student_other_instruments enable row level security;
alter table public.portal_student_interests enable row level security;
alter table public.portal_student_school_background enable row level security;
alter table public.portal_support_requests enable row level security;
alter table public.portal_student_status_events enable row level security;
alter table public.portal_onboarding_completions enable row level security;
alter table public.portal_onboarding_progress enable row level security;
alter table public.portal_onboarding_step_receipts enable row level security;

revoke all privileges on table public.portal_schools from anon, authenticated;
revoke all privileges on table public.portal_instrument_types from anon, authenticated;
revoke all privileges on table public.portal_interest_types from anon, authenticated;
revoke all privileges on table public.portal_student_profiles from anon, authenticated;
revoke all privileges on table public.portal_student_enrollments from anon, authenticated;
revoke all privileges on table public.portal_student_music_profiles from anon, authenticated;
revoke all privileges on table public.portal_student_other_instruments from anon, authenticated;
revoke all privileges on table public.portal_student_interests from anon, authenticated;
revoke all privileges on table public.portal_student_school_background from anon, authenticated;
revoke all privileges on table public.portal_support_requests from anon, authenticated;
revoke all privileges on table public.portal_student_status_events from anon, authenticated;
revoke all privileges on table public.portal_onboarding_completions from anon, authenticated;
revoke all privileges on table public.portal_onboarding_progress from anon, authenticated;
revoke all privileges on table public.portal_onboarding_step_receipts from anon, authenticated;

comment on table portal_student_profiles is
  'Student-supplied name pronunciation and optional pronouns; authorized detail context only.';
comment on table portal_onboarding_completions is
  'Versioned completion evidence pointing to connected current records; never a duplicate answer blob.';
comment on column portal_contact_methods.contact_purpose is
  'Describes why the method is retained. It does not authorize a communication channel.';
