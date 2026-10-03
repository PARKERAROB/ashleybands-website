-- Ascend staff flags (#172, Rob 2026-10-03): staff flag cleaning zones on an unlisted, no-login page.
-- provenance: staff-entered name, zone, rating, area, groups and note submitted through /api/ascend-check/flags.
-- device_hash is SHA-256 of a random per-device id kept in the browser; it lets a device edit its own flags.

create table if not exists public.ascend_staff_flags (
  id uuid primary key default gen_random_uuid(),
  rehearsal_date date not null,
  zone text not null check (zone ~ '^[0-9]{1,2}-[0-9]{1,2}$'),
  color text not null check (color in ('red', 'yellow', 'green')),
  area text not null check (area in ('music', 'choreo', 'marching')),
  groups text[] not null check (cardinality(groups) between 1 and 11),
  note text not null default '' check (char_length(note) <= 500),
  name text not null check (char_length(name) between 1 and 60),
  device_hash text not null check (char_length(device_hash) = 64),
  source text not null default 'staff_flag_page',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ascend_staff_flags_date_idx on public.ascend_staff_flags (rehearsal_date);

alter table public.ascend_staff_flags enable row level security;
revoke all on table public.ascend_staff_flags from anon, authenticated;

comment on table public.ascend_staff_flags is
  'Staff flags for Ascend cleaning zones. Service-role writes only through /api/ascend-check/flags; a device edits only rows matching its device_hash.';
