-- provenance: two additions, both staff/program data, no new contact surface.
--
-- 1) portal_students.mb_role_2026 -- a PROJECTION of BandsofAHS/data/students.csv (the
--    roster home) in exactly the same class as grade_fall26, which is already mirrored.
--    Program role, NOT a contact value, so the 2026-07-10 contact-value guard in
--    sync-portal-csv.mjs does not apply and is untouched.
--    Why it is needed: uniform sizing reads a DIFFERENT Synced Up chart for guard vs
--    everyone else, and the same label means different bodies on the two charts (band M
--    chest 39-41, guard M chest 32-34). Without the role, the portal cannot tell the
--    lanes apart and every guard student would be sized off the wrong chart by 2+ sizes.
--    Backfilled below from the roster; sync-portal-csv.mjs now carries it forward.
--
-- 2) portal_student_measurements size-override columns -- Rob's pick always wins over
--    the computed recommendation (Rob 7/16). size_computed_at_override snapshots what
--    the math said AT the moment he overrode, so a later re-measure that would compute
--    differently can be surfaced as DRIFT instead of silently replacing his judgment.
--    Writes go through /api/admin/sizes behind validateStaffRequest and are audited via
--    lib/auditLog.js like every other admin write.
--
-- The recommendation itself is deliberately NOT stored: it is derived from the
-- measurements on read (lib/uniformSizing.js). Storing it would create a second home for
-- a fact the measurements already own, and it would go stale the moment a tape moves.

alter table portal_students
  add column if not exists mb_role_2026 text;

alter table portal_student_measurements
  add column if not exists size_override text,
  add column if not exists size_override_by text,
  add column if not exists size_override_at timestamptz,
  add column if not exists size_computed_at_override text;
