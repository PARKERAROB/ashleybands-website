-- Ascend self check (#172): students send a per-zone self-assessment to staff.
-- provenance: student-entered drill number (letter + 1-2 digits), ratings, checks and note
-- submitted through /api/ascend-check. No names or other personal identifiers are collected.

create table if not exists public.ascend_self_checks (
  id uuid primary key default gen_random_uuid(),
  rehearsal_date date not null,
  drill_number text not null check (drill_number ~ '^[A-Z][1-9][0-9]?$'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) < 32768),
  source text not null default 'student_self_check',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rehearsal_date, drill_number)
);

alter table public.ascend_self_checks enable row level security;
revoke all on table public.ascend_self_checks from anon, authenticated;

comment on table public.ascend_self_checks is
  'Student Ascend self checks, one per drill number per rehearsal date; resubmit overwrites. Service-role writes only; staff reads are application-authorized and audited.';

-- One-row shared rehearsal code that staff set from /admin/ascend-check without a deploy.
create table if not exists public.ascend_self_check_settings (
  id smallint primary key default 1 check (id = 1),
  rehearsal_code text not null check (char_length(rehearsal_code) between 3 and 40),
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table public.ascend_self_check_settings enable row level security;
revoke all on table public.ascend_self_check_settings from anon, authenticated;
