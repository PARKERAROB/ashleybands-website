-- Issue #85: private self-reported preferences, not assignments. No roster seed data.
create table public.percussion_part_preferences (
  survey_key text not null default 'fall-2026' check (survey_key = 'fall-2026'),
  student_id uuid not null references public.portal_students(id),
  submitted_by_person_id uuid not null references public.portal_people(id),
  choices jsonb not null,
  source text not null default 'portal_student_self' check (source = 'portal_student_self'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (survey_key,student_id),
  constraint six_valid_choices check (coalesce(jsonb_typeof(choices)='object' and
    choices - array['freedom','legends','salute','cenotaph','bernstein','entertainer'] = '{}'::jsonb and
    choices ? 'freedom' and choices->>'freedom' in ('percussion1','timpani','percussion2') and
    choices ? 'legends' and choices->>'legends' in ('percussion1','percussion2','keyboard','timpani') and
    choices ? 'salute' and choices->>'salute' in ('mallets','percussion1','percussion2') and
    choices ? 'cenotaph' and choices->>'cenotaph' in ('percussion1','percussion2','percussion3','percussion4','timpani') and
    choices ? 'bernstein' and choices->>'bernstein' in ('timpani','mallets','percussion') and
    choices ? 'entertainer' and choices->>'entertainer' in ('drums','xylophone'),false))
);
alter table public.percussion_part_preferences enable row level security;
revoke all on public.percussion_part_preferences from anon, authenticated;
grant all on public.percussion_part_preferences to service_role;
comment on table public.percussion_part_preferences is 'Source: authenticated portal student self report. Private director review; preferences do not assign parts.';
