-- Geo + proximity for the sponsorship prospect database.
-- The OSM importer computed coordinates only to bucket a coarse "zone" and then
-- discarded them, so the list could not be ranked by actual distance from the
-- school. The whole sponsorship goal is "move outward from Ashley High School,"
-- which needs real coordinates and a distance. Additive + reversible.
--
-- distance_mi = great-circle miles from Eugene Ashley HS (34.10028, -77.91172),
-- backfilled by scripts/backfill-geo.mjs.

alter table businesses
  add column if not exists lat double precision,
  add column if not exists lon double precision,
  add column if not exists distance_mi numeric,
  add column if not exists geocoded_at timestamptz;

create index if not exists businesses_distance_idx on businesses(distance_mi);
