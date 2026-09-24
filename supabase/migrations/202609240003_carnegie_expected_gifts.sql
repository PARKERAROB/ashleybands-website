-- Staff-recorded expected Carnegie gifts (#110).
--
-- Additive and inert: two new private tables and their triggers; no existing table, view or row
-- changes. An expected gift is a promise, not a gift: no total reads this table and no receipt is
-- sent. Staff confirm it when the money arrives through the #103 offline path, which creates
-- exactly one confirmed Carnegie gift (sponsor_gift_id, unique), or cancel it with a reason.
-- provenance: donor, amount, method, platform, dates, designation and note are entered by staff
-- (source = 'staff') or by Atlas on the director's instruction (source = 'atlas').

create table public.carnegie_expected_gifts (
  id uuid primary key default gen_random_uuid(),
  portal_student_id uuid references public.portal_students(id),
  donor_name text not null check (char_length(btrim(donor_name)) between 1 and 160),
  donor_email text not null default '' check (char_length(donor_email) <= 254),
  amount_cents integer not null check (amount_cents >= 100 and amount_cents <= 5000000),
  method text not null check (method in ('employer_platform', 'check', 'cash', 'other')),
  platform text not null default '' check (char_length(platform) <= 80),
  gift_type text not null default 'donation' check (gift_type in ('donation', 'employee_gift', 'employer_match')),
  gift_date date,
  expected_date date,
  designation text not null default '' check (char_length(designation) <= 300),
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'expected' check (status in ('expected', 'confirmed', 'cancelled')),
  confirmed_amount_cents integer check (confirmed_amount_cents is null or confirmed_amount_cents > 0),
  confirmed_method text check (confirmed_method is null or confirmed_method in ('employer_platform', 'check', 'cash', 'other')),
  sponsor_gift_id uuid unique references public.sponsor_gifts(id),
  cancel_reason text not null default '' check (char_length(cancel_reason) <= 500),
  entered_by text not null check (char_length(btrim(entered_by)) between 1 and 120),
  reviewed_by_staff_id uuid references public.staff(id),
  reviewed_at timestamptz,
  source text not null default 'staff' check (source in ('staff', 'atlas')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carnegie_expected_gift_state check (
    (status = 'expected' and sponsor_gift_id is null and confirmed_amount_cents is null and reviewed_at is null)
    or (status = 'confirmed' and sponsor_gift_id is not null and confirmed_amount_cents is not null and confirmed_method is not null and reviewed_by_staff_id is not null and reviewed_at is not null)
    or (status = 'cancelled' and sponsor_gift_id is null and btrim(cancel_reason) <> '' and reviewed_by_staff_id is not null and reviewed_at is not null)
  )
);
create index carnegie_expected_gifts_student_idx on public.carnegie_expected_gifts (portal_student_id, created_at desc);
create index carnegie_expected_gifts_status_idx on public.carnegie_expected_gifts (status, created_at);

create table public.carnegie_expected_gift_events (
  id bigint generated always as identity primary key,
  expected_gift_id uuid not null references public.carnegie_expected_gifts(id),
  status text not null,
  amount_cents integer not null,
  confirmed_amount_cents integer,
  confirmed_method text,
  sponsor_gift_id uuid,
  actor text not null,
  source text not null,
  created_at timestamptz not null default now()
);
create index carnegie_expected_gift_events_idx on public.carnegie_expected_gift_events (expected_gift_id, id);

create or replace function public.carnegie_expected_gift_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.status := 'expected';
    new.sponsor_gift_id := null;
    new.confirmed_amount_cents := null;
    new.confirmed_method := null;
    new.reviewed_by_staff_id := null;
    new.reviewed_at := null;
    new.cancel_reason := '';
    return new;
  end if;
  if old.status <> 'expected' then
    raise exception 'A confirmed or cancelled expected gift is final' using errcode = 'check_violation';
  end if;
  if (new.portal_student_id, new.donor_name, new.amount_cents, new.method, new.entered_by, new.source, new.created_at)
     is distinct from (old.portal_student_id, old.donor_name, old.amount_cents, old.method, old.entered_by, old.source, old.created_at) then
    raise exception 'Record a new expected gift instead of rewriting this one' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger carnegie_expected_gift_guard
before insert or update on public.carnegie_expected_gifts
for each row execute function public.carnegie_expected_gift_guard();

create or replace function public.carnegie_expected_gift_history()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.carnegie_expected_gift_events (expected_gift_id, status, amount_cents, confirmed_amount_cents, confirmed_method, sponsor_gift_id, actor, source)
  values (new.id, new.status, new.amount_cents, new.confirmed_amount_cents, new.confirmed_method, new.sponsor_gift_id,
    case when tg_op = 'INSERT' then new.entered_by else 'staff:' || coalesce(new.reviewed_by_staff_id::text, '') end,
    case when tg_op = 'INSERT' then new.source else 'staff' end);
  return null;
end;
$$;
create trigger carnegie_expected_gift_history
after insert or update on public.carnegie_expected_gifts
for each row execute function public.carnegie_expected_gift_history();

alter table public.carnegie_expected_gifts enable row level security;
alter table public.carnegie_expected_gift_events enable row level security;
revoke all privileges on table public.carnegie_expected_gifts from anon, authenticated;
revoke all privileges on table public.carnegie_expected_gift_events from anon, authenticated;
grant select, insert, update on public.carnegie_expected_gifts to service_role;
grant select, insert on public.carnegie_expected_gift_events to service_role;
revoke delete, truncate on public.carnegie_expected_gifts from service_role;
revoke update, delete, truncate on public.carnegie_expected_gift_events from service_role;
revoke all on function public.carnegie_expected_gift_guard() from public, anon, authenticated;
revoke all on function public.carnegie_expected_gift_history() from public, anon, authenticated;

comment on table public.carnegie_expected_gifts is
  'Staff-recorded expected Carnegie gifts (#110). Pending promises; counted in no total and never receipted until staff confirm through the #103 offline path. Inert until CARNEGIE_LETTERS_MODE is set.';
