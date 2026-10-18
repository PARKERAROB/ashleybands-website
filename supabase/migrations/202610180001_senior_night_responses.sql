-- Issue #216: Senior Night 2026 announcer details, self-reported by each senior in the Family Portal.
-- provenance: source column; portal_student_self only. No roster seed data.
create table public.senior_night_responses (
  event_key text not null default 'senior-night-2026' check (event_key = 'senior-night-2026'),
  student_id uuid not null references public.portal_students(id),
  submitted_by_person_id uuid not null references public.portal_people(id),
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  source text not null default 'portal_student_self' check (source = 'portal_student_self'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_key, student_id)
);
alter table public.senior_night_responses enable row level security;
revoke all on public.senior_night_responses from anon, authenticated;
grant all on public.senior_night_responses to service_role;
comment on table public.senior_night_responses is 'Source: authenticated portal student self report. Private staff use for the Senior Night announcer script.';
