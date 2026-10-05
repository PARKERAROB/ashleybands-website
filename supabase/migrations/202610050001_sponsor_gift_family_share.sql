-- #176: families can see who gave to their student's Carnegie notes so they can thank them.
-- share_with_family defaults true: existing student-credited gifts are shown (Rob, 2026-10-05).
-- note_to_student is an optional plain-text note from the donor to the student.
-- provenance: both are donor-entered on the public give form; staff-recorded gifts keep the default.
-- Table access is unchanged: RLS on, no anon/authenticated privileges (service role only).

alter table public.sponsor_gifts
  add column if not exists share_with_family boolean not null default true,
  add column if not exists note_to_student text;

alter table public.sponsor_gifts
  drop constraint if exists sponsor_gifts_note_to_student_length;
alter table public.sponsor_gifts
  add constraint sponsor_gifts_note_to_student_length check (note_to_student is null or char_length(note_to_student) <= 500);
