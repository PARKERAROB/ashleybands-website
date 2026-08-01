-- provenance: roster-owned program facts projected into the family portal.
--
-- portal_students.band_class_2026, ensemble_2026, instrument_2026, and
-- marching_2026 are sourced from BandsofAHS/data/students.csv by
-- scripts/sync-portal-csv.mjs. They are program placement fields, not family-owned
-- contact values. The canonical roster remains the home for these facts; the portal
-- stores a read projection so families can see the same current record as staff.
-- Family edits still flow through the existing audited portal request endpoints.

alter table portal_students
  add column if not exists band_class_2026 text,
  add column if not exists ensemble_2026 text,
  add column if not exists instrument_2026 text,
  add column if not exists marching_2026 text;

comment on column portal_students.band_class_2026 is
  'Roster projection from BandsofAHS/data/students.csv band_class_2026; synced by scripts/sync-portal-csv.mjs.';
comment on column portal_students.ensemble_2026 is
  'Roster projection from BandsofAHS/data/students.csv ensemble_2026; synced by scripts/sync-portal-csv.mjs.';
comment on column portal_students.instrument_2026 is
  'Roster projection from BandsofAHS/data/students.csv instrument; synced by scripts/sync-portal-csv.mjs.';
comment on column portal_students.marching_2026 is
  'Roster projection from BandsofAHS/data/students.csv marching_2026; synced by scripts/sync-portal-csv.mjs.';

notify pgrst, 'reload schema';
