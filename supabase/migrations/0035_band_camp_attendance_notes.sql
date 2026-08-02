-- provenance: Attendance notes are direct observations entered by authorized
-- Band Camp staff or student leadership for the director through /attendance.

alter table band_camp_attendance_2026
  alter column status drop not null,
  add column if not exists note text;

alter table band_camp_attendance_2026
  drop constraint if exists band_camp_attendance_2026_note_length,
  add constraint band_camp_attendance_2026_note_length
    check (note is null or char_length(note) <= 1000);

comment on column band_camp_attendance_2026.note is
  'Optional staff observation included in the director attendance report.';

notify pgrst, 'reload schema';
