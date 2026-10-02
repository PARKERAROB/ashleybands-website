-- Issue #162: one-click media interview permission from a guardian's broadcast email.
-- provenance: each row is one click on a signed per-student link in a portal broadcast
-- (source = 'email_link'). Append-only; the latest row per student is the answer.
-- Private: no browser-role access. Writes go through /api/media-consent with the service role.
create table public.media_consent_responses (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.portal_students(id) on delete cascade,
  answer text not null check (answer in ('yes', 'no')),
  source text not null default 'email_link' check (source in ('email_link', 'staff')),
  user_agent text not null default '',
  created_at timestamptz not null default now()
);

create index media_consent_responses_student_latest
  on public.media_consent_responses (student_id, created_at desc);

alter table public.media_consent_responses enable row level security;
revoke all privileges on table public.media_consent_responses from anon, authenticated;
grant all on table public.media_consent_responses to service_role;

comment on table public.media_consent_responses is
  'Source: guardian click on a signed media-permission link (#162). Latest row per student wins. Staff/service read only.';
