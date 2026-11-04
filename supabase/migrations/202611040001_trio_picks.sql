-- #255: temporary holiday trio picker. One row per student per class period: the piece and part
-- they chose. Shown to the same unlisted page so each period can form trios. Drop at takedown.
-- provenance: student_name (first name and last initial), period, instrument, piece and part are
-- typed or chosen by the student on the unlisted picker page; source records that.
-- Table access: RLS on, no anon/authenticated privileges (service role only).

create table if not exists public.trio_picks (
  id uuid primary key default gen_random_uuid(),
  period text not null check (period in ('1', '2', '4')),
  student_name text not null check (char_length(student_name) between 2 and 24),
  name_key text not null,
  instrument text not null check (char_length(instrument) between 1 and 40),
  piece text not null check (char_length(piece) between 1 and 60),
  part smallint not null check (part between 1 and 3),
  source text not null default 'trio-picker',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period, name_key)
);

alter table public.trio_picks enable row level security;
revoke all on public.trio_picks from anon, authenticated;
