-- Extend student instrument observations so reports can link to the
-- sanitized canonical BDOS instrument snapshot. These columns remain a
-- review queue only and do not mutate BDOS CSV inventory.

alter table public.instrument_inventory
  add column if not exists asset_id text not null default '',
  add column if not exists locker text not null default '',
  add column if not exists location text not null default '',
  add column if not exists repair_needed text not null default '',
  add column if not exists repair_priority text not null default '';

create index if not exists instrument_inventory_asset_id_idx
  on public.instrument_inventory(asset_id);
