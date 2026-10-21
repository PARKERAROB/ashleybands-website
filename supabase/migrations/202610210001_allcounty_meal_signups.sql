-- Issue #221: All-County Honor Band clinic meal orders from NHCS band directors.
-- provenance: each row is one director's own submission on ashleybands.com/all-county/meals
-- (source = 'director_form'). Students are name only, entered by their director: no student
-- email, phone or roster link. paid_* columns are staff-recorded payments from /admin/all-county-meals.
-- Private: no browser-role access. Writes go through /api/all-county/meals with the service role.
create table public.allcounty_meal_signups (
  id uuid primary key default gen_random_uuid(),
  event_key text not null default 'allcounty-2026' check (event_key = 'allcounty-2026'),
  director_name text not null check (char_length(director_name) between 1 and 120),
  director_email text not null check (char_length(director_email) between 3 and 254),
  school text not null check (char_length(school) between 1 and 120),
  students jsonb not null default '[]'::jsonb check (jsonb_typeof(students) = 'array'),
  price_cents integer not null check (price_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  edit_token_hash text not null unique,
  paid_cents integer check (paid_cents >= 0),
  paid_method text check (paid_method in ('check', 'cash', 'mixed')),
  paid_recorded_at timestamptz,
  paid_recorded_by text,
  source text not null default 'director_form' check (source = 'director_form'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One order per director per school, so a resubmission edits instead of duplicating.
create unique index allcounty_meal_signups_director_school
  on public.allcounty_meal_signups (event_key, lower(director_email), lower(school));

alter table public.allcounty_meal_signups enable row level security;
revoke all privileges on table public.allcounty_meal_signups from anon, authenticated;
grant all on table public.allcounty_meal_signups to service_role;

comment on table public.allcounty_meal_signups is
  'Source: director submission on /all-county/meals (#221). Student names are minors from other schools: staff/service read only, never listed publicly.';
