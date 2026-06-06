-- Seed for spring_trip_refund_credits (migration 0021).
-- The 23 eligible spring-trip-payers-who-march, with goal room. Amounts in cents.
-- Conservative confirmed_cents now; topup_cents (+$35) applies later IF the CharterUP
-- courtesy check posts; full_cents = confirmed + topup. status defaults to 'offered'.
--
-- EXCLUDED (not seeded): Noah Powers (fully funded via Jeff Rifkin Portraits sponsorship,
-- deferred to the general/hardship fast-follow); Sky Lockhart (fundraising comp, never
-- paid in, no refund). Everyone not in (trip-payers INTERSECT marchers).
--
-- Idempotent: one row per student (unique index on student_id). Re-running is a no-op.

insert into spring_trip_refund_credits (student_id, confirmed_cents, topup_cents, full_cents) values
  ('49e743f0-c8f6-4554-a222-25a71161909a',  9500, 3500, 13000),  -- Aaron Lescalleet
  ('bd507925-7bf0-46f3-aac2-948801ab90ee', 24500, 3500, 28000),  -- Adam Boyle
  ('49e33014-d36c-46a5-878f-55a54722b079', 24500, 3500, 28000),  -- Ashley Hicks
  ('31876762-d287-4eb6-85eb-c451b236f355', 24500, 3500, 28000),  -- Brady Clamme
  ('dc68aaa6-d26b-4221-86b5-5b444d827854', 24500, 3500, 28000),  -- Brennaugh Coppinger
  ('6c6fb149-10d4-42d7-9c5c-89ab4235a67b', 24500, 3500, 28000),  -- Caleb Pritchard
  ('e4d80a55-a4ca-4db9-b171-8b4b08d3f583', 24500, 3500, 28000),  -- Caleigh Pritchard
  ('e1b539fb-0480-45af-95d6-992692f3722b', 24500, 3500, 28000),  -- Cameron Desorbo
  ('bb3eac6b-9523-4aeb-bc56-102201b25024', 24500, 3500, 28000),  -- Claire Costner
  ('5cb69631-2458-47e4-8827-4b6228e240c6', 24500, 3500, 28000),  -- Cyrus Hill
  ('e79c735e-b1f5-499f-9e69-b442fbffb331', 24500, 3500, 28000),  -- Dan Gregory
  ('07e93949-0ec2-4ac8-b2b2-b0993b1aed07', 24500, 3500, 28000),  -- Dixon Gullett
  ('6202f179-ce5b-46bb-a1ef-26c3033c440c', 24500, 3500, 28000),  -- Giovanni Lopez Martinez
  ('edfd2ffb-55b9-41fa-8de3-3d0baf560551', 24500, 3500, 28000),  -- JT Damstetter
  ('e95eba8a-3b13-45ef-b74e-6bc69f806bec', 14500, 3500, 18000),  -- Justin Naklicki
  ('383c07d4-47c3-4ff5-a129-259ff0a6b706', 24500, 3500, 28000),  -- Kade Rathgeber
  ('a44b6502-22c7-4d87-b999-55b079a8c1f2', 24500, 3500, 28000),  -- Lyla Franklin
  ('0487ebb4-96b3-4e25-a98c-cd58723ad90e', 24500, 3500, 28000),  -- Mackenzie Stoner
  ('7c16ae0d-7061-41da-b08e-5226a89f6dac', 24500, 3500, 28000),  -- Mael Ferigo
  ('cd6e493e-9d28-4ee3-88b9-8ffaa023ae3f', 24500, 3500, 28000),  -- Mercedes Tejedatrejo
  ('68833ea4-f59e-41a9-8b61-2e8f0b7b4ef0', 24500, 3500, 28000),  -- Noah Moffitt
  ('c85e0151-9121-4aeb-9286-83d11e802e1f', 24500, 3500, 28000),  -- Robbe Sears
  ('f8473b0a-d5d0-4076-9e18-889d74f9d12e', 24500, 3500, 28000)   -- Tyler Shook
on conflict (student_id) do nothing;
