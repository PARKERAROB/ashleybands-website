-- Instrument inventory: student-submitted voice/text intake for school-owned instruments.
-- Each row is one student observation. Rob reviews and promotes to canonical inventory.

create table if not exists public.instrument_inventory (
  id uuid primary key default gen_random_uuid(),
  -- Student who submitted
  submitted_by text not null default '',
  submitted_at timestamptz not null default now(),

  -- Core instrument identification
  instrument_type text not null default '',
  brand text not null default '',
  model_markings text not null default '',
  serial_number text not null default '',
  serial_location text not null default '',
  finish text not null default '',
  key_or_pitch text not null default '',
  level text not null default '',

  -- Condition
  condition_notes text not null default '',
  visible_damage text not null default '',
  missing_parts text not null default '',
  plays text not null default '' check (plays in ('yes', 'no', 'not_sure', '')),

  -- Accessories
  case_present text not null default '' check (case_present in ('yes', 'no', 'not_sure', '')),
  mouthpiece_present text not null default '' check (mouthpiece_present in ('yes', 'no', 'not_sure', '')),

  -- Review workflow
  review_status text not null default 'pending' check (review_status in ('pending', 'reviewed', 'verified', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by text not null default '',
  admin_notes text not null default '',

  -- Raw voice transcript (if submitted by voice)
  raw_transcript text not null default ''
);

-- Index for admin review queue
create index if not exists instrument_inventory_review_status_idx
  on public.instrument_inventory(review_status);

-- Index for looking up by instrument type
create index if not exists instrument_inventory_type_idx
  on public.instrument_inventory(instrument_type);
