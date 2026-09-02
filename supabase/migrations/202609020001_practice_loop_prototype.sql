-- Account-free Practice Loop prototype for one current repertoire selection.
-- provenance: student-provided name, instrument, and self-assessment entered through the prototype route.

create table if not exists public.practice_loop_prototype_submissions (
  id uuid primary key default gen_random_uuid(),
  piece_key text not null,
  participant_token_hash text not null,
  display_name text not null check (char_length(display_name) between 2 and 80),
  instrument text not null check (char_length(instrument) between 2 and 40),
  marks jsonb not null default '{}'::jsonb check (jsonb_typeof(marks) = 'object'),
  source text not null default 'student_practice_prototype',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (piece_key, participant_token_hash)
);

alter table public.practice_loop_prototype_submissions enable row level security;

revoke all on table public.practice_loop_prototype_submissions from anon, authenticated;

create index if not exists practice_loop_prototype_piece_updated_idx
  on public.practice_loop_prototype_submissions (piece_key, updated_at desc);

comment on table public.practice_loop_prototype_submissions is
  'Temporary account-free student self-assessment prototype. Service-role writes only; staff reads are application-authorized and audited.';

comment on column public.practice_loop_prototype_submissions.participant_token_hash is
  'SHA-256 of an unguessable browser-local participant key; the raw key is never stored.';
