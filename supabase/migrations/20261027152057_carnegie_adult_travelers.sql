-- Issue #237: adults coming to New York for Carnegie Hall 2027.
-- provenance: each row is a parent/guardian's own request in the Family Portal
-- (source = 'portal'), linked to their student. official_chaperone is set only by Mr. Parker
-- (Rob, 2026-10-27: anyone can ask; Rob alone marks an official, on-the-bus chaperone).
-- Payments are fee_payments rows with category 'carnegie_2027_adult' on the linked student.
-- Private: no browser-role access. Writes go through /api/portal/carnegie-adults with the service role.
create table public.carnegie_adult_travelers (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.portal_students(id),
  submitted_by_person_id uuid references public.portal_people(id),
  adult_name text not null check (char_length(adult_name) between 1 and 120),
  travel_option text not null check (travel_option in ('with_band', 'own_way')),
  room_type text check (room_type in ('double', 'quad')),
  roommates text not null default '' check (char_length(roommates) <= 300),
  chaperone_interest boolean not null default false,
  official_chaperone boolean not null default false,
  official_set_by text,
  official_set_at timestamptz,
  price_cents integer not null default 0 check (price_cents >= 0),
  status text not null default 'active' check (status in ('active', 'withdrawn')),
  terms_version text,
  terms_accepted_at timestamptz,
  source text not null default 'portal' check (source in ('portal', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (travel_option = 'own_way' or room_type is not null)
);

create index carnegie_adult_travelers_student on public.carnegie_adult_travelers (student_id);

alter table public.carnegie_adult_travelers enable row level security;
revoke all privileges on table public.carnegie_adult_travelers from anon, authenticated;
grant all on table public.carnegie_adult_travelers to service_role;

comment on table public.carnegie_adult_travelers is
  'Source: parent/guardian request in the Family Portal (#237). Adult names only; official_chaperone set by Mr. Parker.';
