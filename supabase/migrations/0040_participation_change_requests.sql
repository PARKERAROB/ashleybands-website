-- Family participation corrections require staff approval before changing the
-- official portal projection. This is the deliberate exception to the general
-- family-profile auto-approval rule in migration 0026.

alter table portal_students
  add column if not exists band_period_2026 text,
  add column if not exists marching_role_category_2026 text,
  add column if not exists marching_assignment_2026 text;

comment on column portal_students.band_period_2026 is
  '2026-27 AHS band period or feeder-school placement; staff-approved family corrections may populate this field.';
comment on column portal_students.marching_role_category_2026 is
  'Broad marching role category, separate from the canonical legacy mb_role_2026 roster value.';
comment on column portal_students.marching_assignment_2026 is
  'Specific marching instrument, equipment, part, or support assignment.';

alter table portal_review_queue drop constraint if exists portal_review_queue_item_type_check;
alter table portal_review_queue add constraint portal_review_queue_item_type_check
  check (item_type in (
    'unknown_email_access', 'guardian_claim', 'email_verified_claim',
    'profile_conflict', 'contact_change', 'sibling_suggestion', 'hard_bounce',
    'duplicate_match', 'sensitive_submission', 'participation_change'
  ));

notify pgrst, 'reload schema';
