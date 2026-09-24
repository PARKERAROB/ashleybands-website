-- Carnegie student letters, path A "family and friends" (#106).
--
-- Additive and inert: four new private tables with triggers on those tables only, no changes to
-- existing tables, views or rows. Nothing reads these tables until CARNEGIE_LETTERS_MODE is set.
-- provenance: letter text, recipient names and optional recipient emails are typed by a trusted Family Portal adult on the
-- student's behalf (source = 'family_portal'); review states are set by staff in the review queue.
-- Recipient names and the student's words are private to that family and staff. No public grants.

create table public.carnegie_student_letters (
  id uuid primary key default gen_random_uuid(),
  portal_student_id uuid not null references public.portal_students(id),
  recipient_type text not null check (recipient_type in ('someone_i_know', 'general_supporter')),
  recipient_name text not null default '' check (char_length(recipient_name) <= 80),
  -- Optional, only to prefill the family's own mail app. The website never sends to it.
  recipient_email text not null default '' check (char_length(recipient_email) <= 254),
  meaning_text text not null default '' check (char_length(meaning_text) <= 1500),
  help_text text not null default '' check (char_length(help_text) <= 1000),
  template_version text not null,
  status text not null default 'draft'
    check (status in ('draft', 'needs_review', 'approved', 'printed', 'delivery_reported')),
  version integer not null default 1 check (version >= 1),
  approved_version integer,
  approved_at timestamptz,
  approved_by_staff_id uuid references public.staff(id),
  review_note text not null default '' check (char_length(review_note) <= 1000),
  submitted_at timestamptz,
  printed_at timestamptz,
  delivery_reported_at timestamptz,
  delivery_channel text check (delivery_channel is null or delivery_channel in ('paper', 'email', 'text')),
  created_by_person_id uuid not null references public.portal_people(id),
  last_actor_type text not null default 'family' check (last_actor_type in ('family', 'staff')),
  last_actor_id text not null default '',
  source text not null default 'family_portal' check (source = 'family_portal'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- An approval covers one exact version. Approved, printed and delivered letters always carry it.
  constraint carnegie_letter_approval_matches check (
    (status in ('approved', 'printed', 'delivery_reported') and approved_version = version and approved_at is not null)
    or (status in ('draft', 'needs_review') and approved_version is null and approved_at is null)
  ),
  constraint carnegie_letter_general_has_no_name check (recipient_type <> 'general_supporter' or recipient_name = '')
);

create index carnegie_student_letters_student_idx on public.carnegie_student_letters (portal_student_id, created_at desc);
create index carnegie_student_letters_status_idx on public.carnegie_student_letters (status, updated_at desc);

-- Append-only history: one row per insert or update, with the exact content hash of that version.
create table public.carnegie_student_letter_events (
  id bigint generated always as identity primary key,
  letter_id uuid not null references public.carnegie_student_letters(id),
  status text not null,
  version integer not null,
  content_sha256 text not null,
  actor_type text not null,
  actor_id text not null default '',
  source text not null default 'family_portal',
  created_at timestamptz not null default now()
);
create index carnegie_student_letter_events_letter_idx on public.carnegie_student_letter_events (letter_id, id);

-- Content edits: bump the version, and an edit after approval returns the letter to review.
-- A reported delivery is final. Enforced here so no route can skip it.
create or replace function public.carnegie_student_letter_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.status := 'draft';
    new.version := 1;
    new.approved_version := null;
    new.approved_at := null;
    new.approved_by_staff_id := null;
  end if;
  if tg_op = 'UPDATE' then
    if new.portal_student_id is distinct from old.portal_student_id
       or new.created_by_person_id is distinct from old.created_by_person_id then
      raise exception 'Letter ownership cannot change' using errcode = 'check_violation';
    end if;
    if (new.recipient_type, new.recipient_name, new.meaning_text, new.help_text)
       is distinct from (old.recipient_type, old.recipient_name, old.meaning_text, old.help_text) then
      if old.status = 'delivery_reported' then
        raise exception 'A delivered letter cannot change' using errcode = 'check_violation';
      end if;
      new.version := old.version + 1;
      if old.status in ('approved', 'printed') or new.status in ('approved', 'printed', 'delivery_reported') then
        new.status := 'needs_review';
      end if;
      if new.status = 'needs_review' or new.status = 'draft' then
        new.approved_version := null;
        new.approved_at := null;
        new.approved_by_staff_id := null;
        new.printed_at := null;
      end if;
    elsif new.version is distinct from old.version then
      raise exception 'Version changes only with content' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger carnegie_student_letter_guard
before insert or update on public.carnegie_student_letters
for each row execute function public.carnegie_student_letter_guard();

create or replace function public.carnegie_student_letter_history()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.carnegie_student_letter_events (letter_id, status, version, content_sha256, actor_type, actor_id, source)
  values (
    new.id, new.status, new.version,
    encode(sha256(convert_to(concat_ws(E'\x1f', new.recipient_type, new.recipient_name, new.meaning_text, new.help_text, new.template_version), 'UTF8')), 'hex'),
    new.last_actor_type, new.last_actor_id, new.source
  );
  return null;
end;
$$;

create trigger carnegie_student_letter_history
after insert or update on public.carnegie_student_letters
for each row execute function public.carnegie_student_letter_history();

alter table public.carnegie_student_letters enable row level security;
alter table public.carnegie_student_letter_events enable row level security;
revoke all privileges on table public.carnegie_student_letters from anon, authenticated;
revoke all privileges on table public.carnegie_student_letter_events from anon, authenticated;
grant select, insert, update on public.carnegie_student_letters to service_role;
grant select, insert on public.carnegie_student_letter_events to service_role;
revoke update, delete, truncate on public.carnegie_student_letter_events from service_role;
revoke delete, truncate on public.carnegie_student_letters from service_role;
revoke all on function public.carnegie_student_letter_guard() from public, anon, authenticated;
revoke all on function public.carnegie_student_letter_history() from public, anon, authenticated;

comment on table public.carnegie_student_letters is
  'Source: Family Portal adult writing on the student''s behalf (#106). Private to that family and staff. The student''s words are stored exactly as typed; staff review states only. Inert until CARNEGIE_LETTERS_MODE is set.';
comment on table public.carnegie_student_letter_events is
  'Append-only letter history (#106): status, version and content hash per change. No updates or deletes.';

-- ---- Student-reported offline gifts (#106, director scope addition 2026-09-24) -------------
-- A family reports cash or a check a student collected. The report is unverified: it is not a
-- gift, is never read by any total, and sends no receipt. Staff confirm it through the existing
-- #103 offline-gift path, which creates exactly one confirmed Carnegie gift in sponsor_gifts, or
-- reject it with a reason. Confirmed and rejected reports are final.
-- provenance: donor name, email, amount, method and note are typed by a trusted Family Portal
-- adult (source = 'family_portal'); review fields are set by staff in the review queue.
create table public.carnegie_reported_gifts (
  id uuid primary key default gen_random_uuid(),
  portal_student_id uuid not null references public.portal_students(id),
  reported_by_person_id uuid not null references public.portal_people(id),
  donor_name text not null check (char_length(btrim(donor_name)) between 1 and 160),
  donor_email text not null default '' check (char_length(donor_email) <= 254),
  reported_amount_cents integer not null check (reported_amount_cents >= 100 and reported_amount_cents <= 5000000),
  reported_method text not null check (reported_method in ('cash', 'check')),
  check_number text not null default '' check (char_length(check_number) <= 40),
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'reported' check (status in ('reported', 'confirmed', 'rejected')),
  confirmed_amount_cents integer check (confirmed_amount_cents is null or confirmed_amount_cents > 0),
  confirmed_method text check (confirmed_method is null or confirmed_method in ('cash', 'check')),
  sponsor_gift_id uuid unique references public.sponsor_gifts(id),
  reject_reason text not null default '' check (char_length(reject_reason) <= 500),
  reviewed_by_staff_id uuid references public.staff(id),
  reviewed_at timestamptz,
  source text not null default 'family_portal' check (source = 'family_portal'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carnegie_reported_gift_review_state check (
    (status = 'reported' and sponsor_gift_id is null and confirmed_amount_cents is null and reviewed_at is null)
    or (status = 'confirmed' and sponsor_gift_id is not null and confirmed_amount_cents is not null and confirmed_method is not null and reviewed_by_staff_id is not null and reviewed_at is not null)
    or (status = 'rejected' and sponsor_gift_id is null and btrim(reject_reason) <> '' and reviewed_by_staff_id is not null and reviewed_at is not null)
  )
);
create index carnegie_reported_gifts_student_idx on public.carnegie_reported_gifts (portal_student_id, created_at desc);
create index carnegie_reported_gifts_status_idx on public.carnegie_reported_gifts (status, created_at);

create table public.carnegie_reported_gift_events (
  id bigint generated always as identity primary key,
  reported_gift_id uuid not null references public.carnegie_reported_gifts(id),
  status text not null,
  reported_amount_cents integer not null,
  confirmed_amount_cents integer,
  confirmed_method text,
  sponsor_gift_id uuid,
  actor_type text not null,
  actor_id text not null default '',
  source text not null default 'family_portal',
  created_at timestamptz not null default now()
);
create index carnegie_reported_gift_events_idx on public.carnegie_reported_gift_events (reported_gift_id, id);

create or replace function public.carnegie_reported_gift_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.status := 'reported';
    new.sponsor_gift_id := null;
    new.confirmed_amount_cents := null;
    new.confirmed_method := null;
    new.reviewed_by_staff_id := null;
    new.reviewed_at := null;
    new.reject_reason := '';
  else
    if old.status <> 'reported' then
      raise exception 'A reviewed gift report is final' using errcode = 'check_violation';
    end if;
    if (new.portal_student_id, new.reported_by_person_id, new.donor_name, new.donor_email, new.reported_amount_cents, new.reported_method, new.check_number, new.note, new.created_at)
       is distinct from (old.portal_student_id, old.reported_by_person_id, old.donor_name, old.donor_email, old.reported_amount_cents, old.reported_method, old.check_number, old.note, old.created_at) then
      raise exception 'The original report cannot change' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger carnegie_reported_gift_guard
before insert or update on public.carnegie_reported_gifts
for each row execute function public.carnegie_reported_gift_guard();

create or replace function public.carnegie_reported_gift_history()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.carnegie_reported_gift_events (reported_gift_id, status, reported_amount_cents, confirmed_amount_cents, confirmed_method, sponsor_gift_id, actor_type, actor_id, source)
  values (
    new.id, new.status, new.reported_amount_cents, new.confirmed_amount_cents, new.confirmed_method, new.sponsor_gift_id,
    case when tg_op = 'INSERT' then 'family' else 'staff' end,
    case when tg_op = 'INSERT' then new.reported_by_person_id::text else coalesce(new.reviewed_by_staff_id::text, '') end,
    new.source
  );
  return null;
end;
$$;

create trigger carnegie_reported_gift_history
after insert or update on public.carnegie_reported_gifts
for each row execute function public.carnegie_reported_gift_history();

alter table public.carnegie_reported_gifts enable row level security;
alter table public.carnegie_reported_gift_events enable row level security;
revoke all privileges on table public.carnegie_reported_gifts from anon, authenticated;
revoke all privileges on table public.carnegie_reported_gift_events from anon, authenticated;
grant select, insert, update on public.carnegie_reported_gifts to service_role;
grant select, insert on public.carnegie_reported_gift_events to service_role;
revoke update, delete, truncate on public.carnegie_reported_gift_events from service_role;
revoke delete, truncate on public.carnegie_reported_gifts from service_role;
revoke all on function public.carnegie_reported_gift_guard() from public, anon, authenticated;
revoke all on function public.carnegie_reported_gift_history() from public, anon, authenticated;

comment on table public.carnegie_reported_gifts is
  'Source: Family Portal adult reporting cash or a check a student collected (#106). Unverified and never counted in any total; staff confirm through the #103 offline-gift path (one sponsor_gifts row) or reject with a reason. Inert until CARNEGIE_LETTERS_MODE is set.';
comment on table public.carnegie_reported_gift_events is
  'Append-only history of reported gifts (#106): who reported, who confirmed or rejected, when, and original versus confirmed amount.';
