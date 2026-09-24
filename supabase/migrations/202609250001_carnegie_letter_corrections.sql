-- Carnegie letter corrections, student authors and student-reported gifts (#108).
--
-- Additive and inert until CARNEGIE_LETTERS_MODE is set. A correction is a proposed spelling,
-- grammar and punctuation fix to one exact letter version. The student's original words stay in
-- carnegie_student_letters unchanged; staff may approve the letter with one correction, which is
-- then what prints and what the email carries. Atlas may only suggest; staff decide.
-- provenance: correction text is proposed by Atlas (source = 'atlas', from the command-line
-- script with the server key) or by a staff reviewer (source = 'staff'); decisions are staff.

create table public.carnegie_letter_corrections (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid not null references public.carnegie_student_letters(id),
  letter_version integer not null,
  meaning_text text not null check (char_length(meaning_text) <= 1500),
  help_text text not null check (char_length(help_text) <= 1000),
  note text not null default '' check (char_length(note) <= 500),
  source text not null check (source in ('atlas', 'staff')),
  proposed_by text not null check (char_length(btrim(proposed_by)) between 1 and 120),
  status text not null default 'suggested' check (status in ('suggested', 'accepted', 'dismissed')),
  reviewed_by_staff_id uuid references public.staff(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint carnegie_letter_correction_review check (
    (status = 'suggested' and reviewed_by_staff_id is null and reviewed_at is null)
    or (status in ('accepted', 'dismissed') and reviewed_by_staff_id is not null and reviewed_at is not null)
  )
);
create index carnegie_letter_corrections_letter_idx on public.carnegie_letter_corrections (letter_id, created_at desc);
create unique index carnegie_letter_corrections_one_accepted on public.carnegie_letter_corrections (letter_id, letter_version) where status = 'accepted';

-- The approval names the exact correction, if any, that prints.
alter table public.carnegie_student_letters
  add column approved_correction_id uuid references public.carnegie_letter_corrections(id);

-- A student signed in with their own school email may write their own letters.
alter table public.carnegie_student_letters drop constraint carnegie_student_letters_last_actor_type_check;
alter table public.carnegie_student_letters add constraint carnegie_student_letters_last_actor_type_check
  check (last_actor_type in ('family', 'student', 'staff'));

-- A correction can be approved only for the version it was written against, and it must match
-- the letter. Any content edit clears it with the rest of the approval. The trigger name sorts
-- after carnegie_student_letter_guard so it sees the status that guard settles.
create or replace function public.carnegie_letter_correction_matches()
returns trigger
language plpgsql
set search_path = public
as $$
declare c record;
begin
  if new.approved_correction_id is null then return new; end if;
  if new.status not in ('approved', 'printed', 'delivery_reported') then
    new.approved_correction_id := null;
    return new;
  end if;
  select letter_id, letter_version, status into c from public.carnegie_letter_corrections where id = new.approved_correction_id;
  if c.letter_id is distinct from new.id or c.letter_version is distinct from new.version or c.status <> 'accepted' then
    raise exception 'The approved correction must be accepted and match this letter version' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger carnegie_student_letter_zz_correction_matches
before update on public.carnegie_student_letters
for each row execute function public.carnegie_letter_correction_matches();

-- Corrections are append-only except for the one review decision.
create or replace function public.carnegie_letter_correction_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'suggested';
    new.reviewed_by_staff_id := null;
    new.reviewed_at := null;
    return new;
  end if;
  if old.status <> 'suggested' then
    raise exception 'A reviewed correction is final' using errcode = 'check_violation';
  end if;
  if (new.letter_id, new.letter_version, new.meaning_text, new.help_text, new.source, new.proposed_by, new.created_at)
     is distinct from (old.letter_id, old.letter_version, old.meaning_text, old.help_text, old.source, old.proposed_by, old.created_at) then
    raise exception 'A correction cannot be rewritten; propose a new one' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger carnegie_letter_correction_guard
before insert or update on public.carnegie_letter_corrections
for each row execute function public.carnegie_letter_correction_guard();

-- Who did what, in the existing letter history.
create or replace function public.carnegie_letter_correction_history()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.carnegie_student_letter_events (letter_id, status, version, content_sha256, actor_type, actor_id, source)
  values (
    new.letter_id,
    'correction_' || new.status,
    new.letter_version,
    encode(sha256(convert_to(concat_ws(E'\x1f', new.meaning_text, new.help_text), 'UTF8')), 'hex'),
    case when tg_op = 'INSERT' then new.source else 'staff' end,
    case when tg_op = 'INSERT' then new.proposed_by else coalesce(new.reviewed_by_staff_id::text, '') end,
    'correction'
  );
  return null;
end;
$$;
create trigger carnegie_letter_correction_history
after insert or update on public.carnegie_letter_corrections
for each row execute function public.carnegie_letter_correction_history();

-- A student signed in with their own school email may report cash or a check they collected
-- (director, 2026-09-24). The report records who reported it; the rules are unchanged: pending,
-- in no total, confirmed only by staff through the #103 offline path.
alter table public.carnegie_reported_gifts
  add column reported_by_type text not null default 'family' check (reported_by_type in ('family', 'student'));

create or replace function public.carnegie_reported_gift_history()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  insert into public.carnegie_reported_gift_events (reported_gift_id, status, reported_amount_cents, confirmed_amount_cents, confirmed_method, sponsor_gift_id, actor_type, actor_id, source)
  values (
    new.id, new.status, new.reported_amount_cents, new.confirmed_amount_cents, new.confirmed_method, new.sponsor_gift_id,
    case when tg_op = 'INSERT' then new.reported_by_type else 'staff' end,
    case when tg_op = 'INSERT' then new.reported_by_person_id::text else coalesce(new.reviewed_by_staff_id::text, '') end,
    new.source
  );
  return null;
end;
$$;
revoke all on function public.carnegie_reported_gift_history() from public, anon, authenticated;

-- Approve one exact letter version together with one correction, atomically. Staff only: the
-- route checks the reviewer before calling it, and only the service role may execute it.
create or replace function public.approve_carnegie_letter_with_correction(p_letter uuid, p_version integer, p_correction uuid, p_staff uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare n integer;
begin
  update public.carnegie_letter_corrections
     set status = 'accepted', reviewed_by_staff_id = p_staff, reviewed_at = now()
   where id = p_correction and letter_id = p_letter and letter_version = p_version and status = 'suggested';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'That correction is not open for this letter version' using errcode = 'serialization_failure'; end if;
  update public.carnegie_student_letters
     set status = 'approved', approved_version = version, approved_at = now(), approved_by_staff_id = p_staff,
         approved_correction_id = p_correction, review_note = '', last_actor_type = 'staff', last_actor_id = p_staff::text
   where id = p_letter and version = p_version and status = 'needs_review';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'This letter changed since it was opened' using errcode = 'serialization_failure'; end if;
  return p_letter;
end;
$$;

alter table public.carnegie_letter_corrections enable row level security;
revoke all privileges on table public.carnegie_letter_corrections from anon, authenticated;
grant select, insert, update on public.carnegie_letter_corrections to service_role;
revoke delete, truncate on public.carnegie_letter_corrections from service_role;
revoke all on function public.carnegie_letter_correction_matches() from public, anon, authenticated;
revoke all on function public.carnegie_letter_correction_guard() from public, anon, authenticated;
revoke all on function public.carnegie_letter_correction_history() from public, anon, authenticated;
revoke all on function public.approve_carnegie_letter_with_correction(uuid, integer, uuid, uuid) from public, anon, authenticated;
grant execute on function public.approve_carnegie_letter_with_correction(uuid, integer, uuid, uuid) to service_role;

comment on table public.carnegie_letter_corrections is
  'Proposed spelling, grammar and punctuation fixes to one letter version (#108). Source atlas or staff; only staff accept. The original student text stays in carnegie_student_letters.';
