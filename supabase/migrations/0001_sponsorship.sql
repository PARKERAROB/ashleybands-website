-- Sponsorship tracker — Phase 2
-- Run in Supabase SQL editor.
-- Designed to fold into the future student-data backend:
--   - separate entity tables (families, businesses, staff) from event table (prospects)
--   - uuid primary keys
--   - role enum on staff for the planned sponsor-lead handoff

create extension if not exists "pgcrypto";

-- ============ Entities ============

create table if not exists families (
  id uuid primary key default gen_random_uuid(),
  display_name text not null unique,
  pin_hash text not null,
  session_token uuid not null default gen_random_uuid(),
  student_first text,
  student_last text,
  section text,
  created_at timestamptz not null default now()
);

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  name_canonical text not null unique,
  name_display text not null,
  category text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  pin_hash text not null,
  display_name text not null,
  role text not null check (role in ('director','sponsor_lead')),
  session_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- ============ Events ============

create table if not exists prospects (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  business_id uuid not null references businesses(id),
  contact_name text,
  relationship_note text,
  status text not null default 'pending' check (status in ('pending','yes','no','later')),
  dropped_off_at date,
  follow_up_at date,
  ask_again_at date,
  committed_amount numeric,
  committed_tier text,
  sent_to_lead boolean not null default false,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prospects_family_idx on prospects(family_id);
create index if not exists prospects_business_idx on prospects(business_id);
create index if not exists prospects_status_idx on prospects(status);

-- ============ Helper for updated_at ============

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists prospects_updated_at on prospects;
create trigger prospects_updated_at
  before update on prospects
  for each row execute function set_updated_at();

-- ============ Dashboard view: dedup ============

create or replace view prospect_dedup as
select
  b.id as business_id,
  b.name_display,
  count(distinct p.family_id) as family_count,
  array_agg(distinct f.display_name) as families
from prospects p
join businesses b on b.id = p.business_id
join families f on f.id = p.family_id
group by b.id, b.name_display
having count(distinct p.family_id) > 1;

-- ============ RLS ============
-- All tables locked down. API routes use SUPABASE_SECRET_KEY (bypasses RLS).
-- Browser code never queries Supabase directly in Phase 2; all access goes
-- through /api/sponsors/* routes that validate session tokens.

alter table families enable row level security;
alter table businesses enable row level security;
alter table staff enable row level security;
alter table prospects enable row level security;
