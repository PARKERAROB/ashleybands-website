-- #247: a trusted adult's whole-trip Music Notes link. Gifts made through it count on that
-- supporter's chart and for the whole trip. They never credit a student.
-- provenance: display_name and code are entered by staff at the director's request;
-- source records who asked. supporter_link_id is set only by the signed supporter link.
-- Table access: RLS on, no anon/authenticated privileges (service role only).

create table if not exists public.carnegie_supporter_links (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9-]{3,40}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  active boolean not null default true,
  source text not null,
  created_at timestamptz not null default now()
);

alter table public.carnegie_supporter_links enable row level security;
revoke all on public.carnegie_supporter_links from anon, authenticated;

alter table public.sponsor_gifts
  add column if not exists supporter_link_id uuid references public.carnegie_supporter_links(id);

alter table public.sponsor_gifts
  drop constraint if exists sponsor_gifts_supporter_not_student;
alter table public.sponsor_gifts
  add constraint sponsor_gifts_supporter_not_student
  check (supporter_link_id is null or portal_student_id is null);

create index if not exists sponsor_gifts_supporter_link_idx
  on public.sponsor_gifts (supporter_link_id)
  where supporter_link_id is not null;
