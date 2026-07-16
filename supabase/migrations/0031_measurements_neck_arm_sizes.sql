-- provenance: staff-entered (source='staff_manual') or family-entered
-- (source='portal_self_edit') uniform measurements, same lanes and same table as
-- 0029 -- these are five additional fields on the existing row, carrying the
-- existing source/measured_by/measured_at provenance columns. No new lane, no new
-- person-data surface. Requested by Rob 2026-07-16 during the uniform fitting.
--
-- Two are true measurements, so they match 0029's numeric(4,1) inches pattern:
--   neck_in        -- around the base of the neck
--   arm_length_in  -- shoulder to wrist
--
-- Three are VENDOR SIZES, not tape measurements, so they are text -- the same call
-- 0029 made for height ("5-9"). Shoe runs half sizes and gendered scales ("10.5 M",
-- "8 W"); glove and t-shirt are lettered ("S"/"M"/"L"/"XL"/"2XL"). Forcing these
-- numeric would lose the qualifier and silently corrupt the order.
--   shoe_size, glove_size, shirt_size
--
-- All nullable like every 0029 field, so a partial fitting saves and finishes later.
-- Re-measures overwrite and prior values stay in audit_log via the update-diff.

alter table portal_student_measurements
  add column if not exists neck_in numeric(4,1),
  add column if not exists arm_length_in numeric(4,1),
  add column if not exists shoe_size text,
  add column if not exists glove_size text,
  add column if not exists shirt_size text;
