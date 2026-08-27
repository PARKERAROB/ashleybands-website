-- Student sponsorship links: one reusable public link per active portal student.
--
-- The link attributes participation only. Every gift remains a program gift to the
-- AHS Band Boosters; no student owns, withdraws, or receives an individual balance.
--
-- provenance: portal_student_id comes from the current Family Portal relationship graph.

create table if not exists public.sponsor_student_links (
  id uuid primary key default gen_random_uuid(),
  portal_student_id uuid not null references public.portal_students(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Za-z0-9_-]{10,24}$'),
  active boolean not null default true,
  source text not null default 'family_portal'
    check (source in ('family_portal', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (portal_student_id)
);

create index if not exists sponsor_student_links_active_idx
  on public.sponsor_student_links(active) where active = true;

drop trigger if exists sponsor_student_links_updated_at on public.sponsor_student_links;
create trigger sponsor_student_links_updated_at
  before update on public.sponsor_student_links
  for each row execute function set_updated_at();

alter table public.sponsor_gifts
  add column if not exists portal_student_id uuid
    references public.portal_students(id) on delete set null;

-- Preserve the student attribution already carried by portal-created sponsorship families.
update public.sponsor_gifts g
set portal_student_id = f.portal_student_id
from public.families f
where g.family_id = f.id
  and g.portal_student_id is null
  and f.portal_student_id is not null;

create index if not exists sponsor_gifts_portal_student_idx
  on public.sponsor_gifts(portal_student_id);

create or replace view public.sponsor_student_totals
with (security_invoker = true) as
select
  g.portal_student_id,
  count(*) filter (where g.status = 'confirmed') as confirmed_gifts,
  coalesce(sum(g.amount_cents) filter (where g.status = 'confirmed'), 0)::bigint as confirmed_cents
from public.sponsor_gifts g
where g.portal_student_id is not null
group by g.portal_student_id;

alter table public.sponsor_student_links enable row level security;
alter table public.sponsor_gifts enable row level security;

-- There are intentionally no client policies. Public short-link resolution and Family
-- Portal link creation both run through bounded server routes using the service role.
