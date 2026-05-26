-- Staff-only marching band dashboard overrides.
-- Raw form submissions and one-click responses stay immutable; this table records
-- Mr. Parker's current working status when the raw signal needs correction.

create table if not exists public.marching_band_status_overrides_2026 (
  id uuid primary key default gen_random_uuid(),
  source_student_id text not null unique,
  status text not null check (
    status in (
      'no_response',
      'signed_up',
      'mb_info',
      'band_only',
      'out',
      'talk',
      'needs_clarification'
    )
  ),
  notes text not null default '',
  updated_by_staff_id uuid references public.staff(id) on delete set null,
  updated_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mb_status_overrides_status_idx
  on public.marching_band_status_overrides_2026(status);

drop trigger if exists mb_status_overrides_updated_at on public.marching_band_status_overrides_2026;
create trigger mb_status_overrides_updated_at
  before update on public.marching_band_status_overrides_2026
  for each row execute function set_updated_at();

alter table public.marching_band_status_overrides_2026 enable row level security;

notify pgrst, 'reload schema';
