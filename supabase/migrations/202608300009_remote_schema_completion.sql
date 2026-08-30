-- Put manually-created production tables under versioned recovery control.
-- This convergence migration intentionally runs after the connected-operations
-- series. It must not be inserted ahead of migrations already deployed in the
-- production migration history.
-- These definitions match the live schema and are idempotent there. They do
-- not make the legacy student tables authoritative; current operations remain
-- on the portal_* spine.
-- provenance: legacy signup submissions, band recapture responses, staff
-- assignments, and previously hosted application records retained from the
-- approved production Supabase schema.

create extension if not exists vector;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  source_student_id text not null unique,
  first_name text not null default '', last_name text not null default '',
  grade_fall text not null default '', instrument text not null default '',
  student_email text not null default '', student_phone text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.guardians (
  id uuid primary key default gen_random_uuid(),
  email_normalized text not null unique,
  first_name text not null default '', last_name text not null default '', full_name text not null default '',
  email text not null default '', phone text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.student_guardians (
  student_id uuid not null references public.students(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  relationship text not null default '', primary_contact boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (student_id,guardian_id)
);
create table if not exists public.marching_band_signup_2026 (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.students(id) on delete cascade,
  guardian_id uuid references public.guardians(id) on delete set null,
  funding_path text not null default '', known_conflicts text not null default '',
  volunteer_areas text[] not null default '{}', questions text not null default '',
  emergency_contact_name text not null default '', emergency_contact_phone text not null default '',
  medical_notes text not null default '',
  student_acknowledgment boolean not null default false,
  parent_acknowledgment boolean not null default false,
  calendar_acknowledgment boolean not null default false,
  financial_acknowledgment boolean not null default false,
  volunteer_acknowledgment boolean not null default false,
  travel_permission boolean not null default false,
  emergency_care_permission boolean not null default false,
  student_signature text not null default '', parent_signature text not null default '',
  submitted_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.band_recapture_2026 (
  id uuid primary key default gen_random_uuid(), student_id text not null,
  student_name text default '', parent_name text default '',
  action text not null check (action in ('out','talk','band_only','mb_info')),
  user_agent text default '', ip text default '', created_at timestamptz not null default now(),
  responder_email text default '', response_note text default ''
);
create index if not exists band_recapture_2026_created_at_idx on public.band_recapture_2026(created_at desc);
create index if not exists band_recapture_2026_student_id_idx on public.band_recapture_2026(student_id);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  title text not null, status text not null default 'draft', summary text not null,
  artifact_type text not null default 'outline', outline jsonb not null default '[]',
  decisions text[] not null default '{}', next_artifacts text[] not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.project_thoughts (
  project_id uuid not null references public.projects(id) on delete cascade,
  thought_id text not null, role text not null default 'supporting',
  pinned_at timestamptz not null default now(), primary key(project_id,thought_id)
);
create table if not exists public.thoughts (
  id uuid primary key default gen_random_uuid(), content text not null,
  embedding vector(1536), metadata jsonb default '{}',
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists thoughts_created_at_idx on public.thoughts(created_at desc);
create index if not exists thoughts_embedding_idx on public.thoughts using hnsw (embedding vector_cosine_ops);
create index if not exists thoughts_metadata_idx on public.thoughts using gin(metadata);
create table if not exists public.thought_relationships (
  id uuid primary key default gen_random_uuid(), source_thought_id text not null,
  target_thought_id text not null, relationship_type text not null,
  confidence numeric not null default 0.5, created_at timestamptz not null default now(),
  unique(source_thought_id,target_thought_id,relationship_type)
);
create table if not exists public.synthesis_artifacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  artifact_type text not null, title text not null, content jsonb not null,
  source_thought_ids text[] not null default '{}', created_at timestamptz not null default now()
);
create table if not exists public.ask_sessions (
  id uuid primary key default gen_random_uuid(), prompt text not null,
  synthesized_answer text not null, retrieval_metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table if not exists public.ask_citations (
  id uuid primary key default gen_random_uuid(),
  ask_session_id uuid not null references public.ask_sessions(id) on delete cascade,
  thought_id text not null, excerpt text not null, relevance_score numeric not null default 0.5
);

create table if not exists public.ascend_part_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.portal_students(id) on delete cascade,
  requested_instrument text not null default '', requested_part text not null default '', requested_note text not null default '',
  requested_by_person_id uuid references public.portal_people(id) on delete set null, requested_at timestamptz,
  locked_instrument text not null default '', locked_part text not null default '', locked_note text not null default '',
  locked_by_staff_id uuid references public.staff(id) on delete set null, locked_by_name text not null default '', locked_at timestamptz,
  part_pdf_url text not null default '', reference_audio_url text not null default '',
  status text not null default 'none' check(status in ('none','requested','locked')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- CREATE TABLE IF NOT EXISTS does not repair a partially-created live table.
-- Add every recovery-owned column explicitly, then enforce the required keys
-- and postconditions below. A conflicting type or invalid existing row fails
-- this migration instead of producing a recovery schema that only looks whole.
alter table public.students
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists source_student_id text,
  add column if not exists first_name text default '',
  add column if not exists last_name text default '',
  add column if not exists grade_fall text default '',
  add column if not exists instrument text default '',
  add column if not exists student_email text default '',
  add column if not exists student_phone text default '',
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();
alter table public.guardians
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists email_normalized text,
  add column if not exists first_name text default '',
  add column if not exists last_name text default '',
  add column if not exists full_name text default '',
  add column if not exists email text default '',
  add column if not exists phone text default '',
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();
alter table public.student_guardians
  add column if not exists student_id uuid,
  add column if not exists guardian_id uuid,
  add column if not exists relationship text default '',
  add column if not exists primary_contact boolean default true,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();
alter table public.marching_band_signup_2026
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists student_id uuid,
  add column if not exists guardian_id uuid,
  add column if not exists funding_path text default '',
  add column if not exists known_conflicts text default '',
  add column if not exists volunteer_areas text[] default '{}',
  add column if not exists questions text default '',
  add column if not exists emergency_contact_name text default '',
  add column if not exists emergency_contact_phone text default '',
  add column if not exists medical_notes text default '',
  add column if not exists student_acknowledgment boolean default false,
  add column if not exists parent_acknowledgment boolean default false,
  add column if not exists calendar_acknowledgment boolean default false,
  add column if not exists financial_acknowledgment boolean default false,
  add column if not exists volunteer_acknowledgment boolean default false,
  add column if not exists travel_permission boolean default false,
  add column if not exists emergency_care_permission boolean default false,
  add column if not exists student_signature text default '',
  add column if not exists parent_signature text default '',
  add column if not exists submitted_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();
alter table public.band_recapture_2026
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists student_id text,
  add column if not exists student_name text default '',
  add column if not exists parent_name text default '',
  add column if not exists action text,
  add column if not exists user_agent text default '',
  add column if not exists ip text default '',
  add column if not exists created_at timestamptz default now(),
  add column if not exists responder_email text default '',
  add column if not exists response_note text default '';
alter table public.projects
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists slug text,
  add column if not exists title text,
  add column if not exists status text default 'draft',
  add column if not exists summary text,
  add column if not exists artifact_type text default 'outline',
  add column if not exists outline jsonb default '[]',
  add column if not exists decisions text[] default '{}',
  add column if not exists next_artifacts text[] default '{}',
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();
alter table public.project_thoughts
  add column if not exists project_id uuid,
  add column if not exists thought_id text,
  add column if not exists role text default 'supporting',
  add column if not exists pinned_at timestamptz default now();
alter table public.thoughts
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists content text,
  add column if not exists embedding vector(1536),
  add column if not exists metadata jsonb default '{}',
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();
alter table public.thought_relationships
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists source_thought_id text,
  add column if not exists target_thought_id text,
  add column if not exists relationship_type text,
  add column if not exists confidence numeric default 0.5,
  add column if not exists created_at timestamptz default now();
alter table public.synthesis_artifacts
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists project_id uuid,
  add column if not exists artifact_type text,
  add column if not exists title text,
  add column if not exists content jsonb,
  add column if not exists source_thought_ids text[] default '{}',
  add column if not exists created_at timestamptz default now();
alter table public.ask_sessions
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists prompt text,
  add column if not exists synthesized_answer text,
  add column if not exists retrieval_metadata jsonb default '{}',
  add column if not exists created_at timestamptz default now();
alter table public.ask_citations
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists ask_session_id uuid,
  add column if not exists thought_id text,
  add column if not exists excerpt text,
  add column if not exists relevance_score numeric default 0.5;
alter table public.ascend_part_assignments
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists student_id uuid,
  add column if not exists requested_instrument text default '',
  add column if not exists requested_part text default '',
  add column if not exists requested_note text default '',
  add column if not exists requested_by_person_id uuid,
  add column if not exists requested_at timestamptz,
  add column if not exists locked_instrument text default '',
  add column if not exists locked_part text default '',
  add column if not exists locked_note text default '',
  add column if not exists locked_by_staff_id uuid,
  add column if not exists locked_by_name text default '',
  add column if not exists locked_at timestamptz,
  add column if not exists part_pdf_url text default '',
  add column if not exists reference_audio_url text default '',
  add column if not exists status text default 'none',
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists students_source_student_id_recovery_uidx
  on public.students(source_student_id);
create unique index if not exists guardians_email_normalized_recovery_uidx
  on public.guardians(email_normalized);
create unique index if not exists student_guardians_identity_recovery_uidx
  on public.student_guardians(student_id, guardian_id);
create unique index if not exists marching_band_signup_student_recovery_uidx
  on public.marching_band_signup_2026(student_id);
create unique index if not exists projects_slug_recovery_uidx
  on public.projects(slug);
create unique index if not exists project_thoughts_identity_recovery_uidx
  on public.project_thoughts(project_id, thought_id);
create unique index if not exists thought_relationships_identity_recovery_uidx
  on public.thought_relationships(source_thought_id, target_thought_id, relationship_type);
create unique index if not exists ascend_part_assignments_student_recovery_uidx
  on public.ascend_part_assignments(student_id);

do $$
declare
  v_missing text;
begin
  with expected(table_name, column_name) as (values
    ('students','id'), ('students','source_student_id'), ('students','first_name'),
    ('students','last_name'), ('students','grade_fall'), ('students','instrument'),
    ('students','student_email'), ('students','student_phone'), ('students','created_at'), ('students','updated_at'),
    ('guardians','id'), ('guardians','email_normalized'), ('guardians','first_name'),
    ('guardians','last_name'), ('guardians','full_name'), ('guardians','email'),
    ('guardians','phone'), ('guardians','created_at'), ('guardians','updated_at'),
    ('student_guardians','student_id'), ('student_guardians','guardian_id'),
    ('student_guardians','relationship'), ('student_guardians','primary_contact'),
    ('marching_band_signup_2026','id'), ('marching_band_signup_2026','student_id'),
    ('marching_band_signup_2026','guardian_id'), ('marching_band_signup_2026','funding_path'),
    ('marching_band_signup_2026','volunteer_areas'), ('marching_band_signup_2026','student_signature'),
    ('marching_band_signup_2026','parent_signature'), ('band_recapture_2026','id'),
    ('band_recapture_2026','student_id'), ('band_recapture_2026','action'),
    ('projects','id'), ('projects','slug'), ('projects','outline'),
    ('project_thoughts','project_id'), ('project_thoughts','thought_id'),
    ('thoughts','id'), ('thoughts','content'), ('thoughts','embedding'),
    ('thought_relationships','id'), ('thought_relationships','source_thought_id'),
    ('thought_relationships','target_thought_id'), ('synthesis_artifacts','id'),
    ('synthesis_artifacts','content'), ('ask_sessions','id'), ('ask_sessions','prompt'),
    ('ask_citations','id'), ('ask_citations','ask_session_id'),
    ('ascend_part_assignments','id'), ('ascend_part_assignments','student_id'),
    ('ascend_part_assignments','status')
  )
  select string_agg(expected.table_name || '.' || expected.column_name, ', ' order by 1)
  into v_missing
  from expected
  left join information_schema.columns actual
    on actual.table_schema = 'public'
   and actual.table_name = expected.table_name
   and actual.column_name = expected.column_name
  where actual.column_name is null;

  if v_missing is not null then
    raise exception 'remote schema convergence missing columns: %', v_missing;
  end if;
end;
$$;

do $$
declare
  v_missing text;
begin
  with expected(constraint_name) as (values
    ('students_pkey'), ('students_source_student_id_key'),
    ('guardians_pkey'), ('guardians_email_normalized_key'),
    ('student_guardians_pkey'), ('student_guardians_student_id_fkey'),
    ('student_guardians_guardian_id_fkey'),
    ('marching_band_signup_2026_pkey'), ('marching_band_signup_2026_student_id_key'),
    ('marching_band_signup_2026_student_id_fkey'), ('marching_band_signup_2026_guardian_id_fkey'),
    ('band_recapture_2026_pkey'), ('band_recapture_2026_action_check'),
    ('projects_pkey'), ('projects_slug_key'),
    ('project_thoughts_pkey'), ('project_thoughts_project_id_fkey'),
    ('thoughts_pkey'), ('thought_relationships_pkey'),
    ('thought_relationships_source_thought_id_target_thought_id_r_key'),
    ('synthesis_artifacts_pkey'), ('synthesis_artifacts_project_id_fkey'),
    ('ask_sessions_pkey'), ('ask_citations_pkey'), ('ask_citations_ask_session_id_fkey'),
    ('ascend_part_assignments_pkey'), ('ascend_part_assignments_student_id_key'),
    ('ascend_part_assignments_student_id_fkey'),
    ('ascend_part_assignments_requested_by_person_id_fkey'),
    ('ascend_part_assignments_locked_by_staff_id_fkey'),
    ('ascend_part_assignments_status_check')
  )
  select string_agg(expected.constraint_name, ', ' order by expected.constraint_name)
  into v_missing
  from expected
  left join pg_constraint actual
    on actual.connamespace = 'public'::regnamespace
   and actual.conname = expected.constraint_name
  where actual.oid is null;

  if v_missing is not null then
    raise exception 'remote schema convergence missing constraints: %', v_missing;
  end if;
end;
$$;

create index if not exists ascend_part_assignments_status_idx on public.ascend_part_assignments(status);
create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists ascend_part_assignments_updated_at on public.ascend_part_assignments;
create trigger ascend_part_assignments_updated_at before update on public.ascend_part_assignments
  for each row execute function public.set_updated_at();
drop trigger if exists thoughts_updated_at on public.thoughts;
create trigger thoughts_updated_at before update on public.thoughts
  for each row execute function public.update_updated_at();

-- The public marching-band signup route calls this one RPC with the publishable
-- key. Keep the legacy signup data together in one transaction and do not make
-- these legacy tables the current portal student source.
create or replace function public.submit_mb_signup_2026(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_guardian_id uuid;
  v_source_student_id text;
  v_student_first text;
  v_student_last text;
  v_student_email text;
  v_guardian_email text;
  v_guardian_full_name text;
  v_guardian_first text;
  v_guardian_last text;
  v_signup_id uuid;
begin
  if jsonb_typeof(payload) <> 'object' then
    raise exception 'Signup payload must be an object';
  end if;

  v_student_first := left(btrim(coalesce(payload->>'student_first_name', '')), 120);
  v_student_last := left(btrim(coalesce(payload->>'student_last_name', '')), 120);
  v_student_email := left(btrim(coalesce(payload->>'student_email', '')), 200);
  v_guardian_email := lower(left(btrim(coalesce(payload->>'guardian_email', '')), 200));
  v_guardian_full_name := left(btrim(coalesce(payload->>'guardian_name', '')), 240);
  v_source_student_id := left(btrim(coalesce(payload->>'source_student_id', '')), 240);

  if v_student_first = '' or v_student_last = '' then
    raise exception 'Student first and last name are required';
  end if;
  if v_guardian_full_name = '' then
    raise exception 'A parent/guardian name is required';
  end if;
  if v_guardian_email = '' or position('@' in v_guardian_email) = 0 then
    raise exception 'A valid parent/guardian email is required';
  end if;

  if v_source_student_id = '' then
    if v_student_email <> '' then
      v_source_student_id := 'email:' || lower(v_student_email);
    else
      v_source_student_id := 'name:' || lower(regexp_replace(
        v_student_first || '-' || v_student_last || '-' || coalesce(payload->>'grade_fall', ''),
        '[^a-zA-Z0-9]+', '-', 'g'
      ));
    end if;
  end if;

  v_guardian_first := split_part(v_guardian_full_name, ' ', 1);
  v_guardian_last := btrim(substr(v_guardian_full_name, length(v_guardian_first) + 1));

  insert into public.students (
    source_student_id, first_name, last_name, grade_fall, instrument,
    student_email, student_phone, updated_at
  ) values (
    v_source_student_id, v_student_first, v_student_last,
    left(btrim(coalesce(payload->>'grade_fall', '')), 80),
    left(btrim(coalesce(payload->>'instrument', '')), 120),
    v_student_email,
    left(btrim(coalesce(payload->>'student_phone', '')), 60), now()
  )
  on conflict (source_student_id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    grade_fall = excluded.grade_fall,
    instrument = excluded.instrument,
    student_email = excluded.student_email,
    student_phone = excluded.student_phone,
    updated_at = now()
  returning id into v_student_id;

  insert into public.guardians (
    email_normalized, first_name, last_name, full_name, email, phone, updated_at
  ) values (
    v_guardian_email, left(v_guardian_first, 120), left(v_guardian_last, 120),
    v_guardian_full_name, left(btrim(coalesce(payload->>'guardian_email', '')), 200),
    left(btrim(coalesce(payload->>'guardian_phone', '')), 60), now()
  )
  on conflict (email_normalized) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    full_name = excluded.full_name,
    email = excluded.email,
    phone = excluded.phone,
    updated_at = now()
  returning id into v_guardian_id;

  insert into public.student_guardians (
    student_id, guardian_id, relationship, primary_contact, updated_at
  ) values (
    v_student_id, v_guardian_id,
    left(btrim(coalesce(payload->>'guardian_relationship', '')), 80), true, now()
  )
  on conflict (student_id, guardian_id) do update set
    relationship = excluded.relationship,
    primary_contact = excluded.primary_contact,
    updated_at = now();

  insert into public.marching_band_signup_2026 (
    student_id, guardian_id, funding_path, known_conflicts, volunteer_areas,
    questions, emergency_contact_name, emergency_contact_phone, medical_notes,
    student_acknowledgment, parent_acknowledgment, calendar_acknowledgment,
    financial_acknowledgment, volunteer_acknowledgment, travel_permission,
    emergency_care_permission, student_signature, parent_signature,
    submitted_at, updated_at
  ) values (
    v_student_id, v_guardian_id,
    left(btrim(coalesce(payload->>'funding_path', '')), 80),
    left(btrim(coalesce(payload->>'known_conflicts', '')), 4000),
    coalesce(array(select jsonb_array_elements_text(coalesce(payload->'volunteer_areas', '[]'::jsonb))), '{}'),
    left(btrim(coalesce(payload->>'questions', '')), 4000),
    left(btrim(coalesce(payload->>'emergency_contact_name', '')), 200),
    left(btrim(coalesce(payload->>'emergency_contact_phone', '')), 80),
    left(btrim(coalesce(payload->>'medical_notes', '')), 4000),
    coalesce((payload->>'student_acknowledgment')::boolean, false),
    coalesce((payload->>'parent_acknowledgment')::boolean, false),
    coalesce((payload->>'calendar_acknowledgment')::boolean, false),
    coalesce((payload->>'financial_acknowledgment')::boolean, false),
    coalesce((payload->>'volunteer_acknowledgment')::boolean, false),
    coalesce((payload->>'travel_permission')::boolean, false),
    coalesce((payload->>'emergency_care_permission')::boolean, false),
    left(btrim(coalesce(payload->>'student_signature', '')), 200),
    left(btrim(coalesce(payload->>'parent_signature', '')), 200), now(), now()
  )
  on conflict (student_id) do update set
    guardian_id = excluded.guardian_id,
    funding_path = excluded.funding_path,
    known_conflicts = excluded.known_conflicts,
    volunteer_areas = excluded.volunteer_areas,
    questions = excluded.questions,
    emergency_contact_name = excluded.emergency_contact_name,
    emergency_contact_phone = excluded.emergency_contact_phone,
    medical_notes = excluded.medical_notes,
    student_acknowledgment = excluded.student_acknowledgment,
    parent_acknowledgment = excluded.parent_acknowledgment,
    calendar_acknowledgment = excluded.calendar_acknowledgment,
    financial_acknowledgment = excluded.financial_acknowledgment,
    volunteer_acknowledgment = excluded.volunteer_acknowledgment,
    travel_permission = excluded.travel_permission,
    emergency_care_permission = excluded.emergency_care_permission,
    student_signature = excluded.student_signature,
    parent_signature = excluded.parent_signature,
    submitted_at = now(),
    updated_at = now()
  returning id into v_signup_id;

  return jsonb_build_object(
    'ok', true, 'student_id', v_student_id,
    'guardian_id', v_guardian_id, 'signup_id', v_signup_id
  );
end;
$$;

alter table public.students enable row level security;
alter table public.guardians enable row level security;
alter table public.student_guardians enable row level security;
alter table public.marching_band_signup_2026 enable row level security;
alter table public.band_recapture_2026 enable row level security;
alter table public.projects enable row level security;
alter table public.project_thoughts enable row level security;
alter table public.thoughts enable row level security;
alter table public.thought_relationships enable row level security;
alter table public.synthesis_artifacts enable row level security;
alter table public.ask_sessions enable row level security;
alter table public.ask_citations enable row level security;
alter table public.ascend_part_assignments enable row level security;

revoke all privileges on table public.students from anon, authenticated;
revoke all privileges on table public.guardians from anon, authenticated;
revoke all privileges on table public.student_guardians from anon, authenticated;
revoke all privileges on table public.marching_band_signup_2026 from anon, authenticated;
revoke all privileges on table public.band_recapture_2026 from anon, authenticated;
revoke all privileges on table public.projects from anon, authenticated;
revoke all privileges on table public.project_thoughts from anon, authenticated;
revoke all privileges on table public.thoughts from anon, authenticated;
revoke all privileges on table public.thought_relationships from anon, authenticated;
revoke all privileges on table public.synthesis_artifacts from anon, authenticated;
revoke all privileges on table public.ask_sessions from anon, authenticated;
revoke all privileges on table public.ask_citations from anon, authenticated;
revoke all privileges on table public.ascend_part_assignments from anon, authenticated;

drop policy if exists "anon insert recapture" on public.band_recapture_2026;
create policy "anon insert recapture"
  on public.band_recapture_2026 for insert to anon with check (true);
grant insert on table public.band_recapture_2026 to anon;

revoke all on function public.submit_mb_signup_2026(jsonb)
  from public, authenticated;
grant execute on function public.submit_mb_signup_2026(jsonb)
  to anon, service_role;
