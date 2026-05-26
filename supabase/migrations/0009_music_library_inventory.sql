-- Music library: student/staff intake for cataloging band repertoire.
-- Each row is one piece observation. Rob reviews and promotes to canonical library.

create table if not exists public.music_library_inventory (
  id uuid primary key default gen_random_uuid(),
  -- Who submitted
  submitted_by text not null default '',
  submitted_at timestamptz not null default now(),

  -- Piece identification
  title text not null default '',
  composer text not null default '',
  arranger_editor text not null default '',
  publisher text not null default '',
  catalog_number text not null default '',
  year text not null default '',
  duration text not null default '',

  -- Classification
  ensemble_type text not null default '' check (ensemble_type in (
    'concert_band', 'wind_ensemble', 'marching_band', 'jazz_band',
    'percussion_ensemble', 'chamber', 'solo', 'method_book', 'classroom_book', 'other', ''
  )),
  publisher_grade text not null default '',

  -- Physical status
  library_status text not null default '' check (library_status in (
    'in_library', 'not_owned', 'metadata_only', 'unknown', ''
  )),
  physical_location text not null default '',
  score_status text not null default '' check (score_status in (
    'present', 'missing', 'digital_only', 'needs_check', ''
  )),
  parts_status text not null default '' check (parts_status in (
    'complete', 'incomplete', 'needs_check', ''
  )),
  missing_parts text not null default '',
  acquired_not_filed text not null default '',
  condition_notes text not null default '',
  ready_to_use text not null default '' check (ready_to_use in ('yes', 'no', 'not_sure', '')),

  -- Review workflow
  review_status text not null default 'pending' check (review_status in ('pending', 'reviewed', 'verified', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by text not null default '',
  admin_notes text not null default '',

  -- Raw voice transcript
  raw_transcript text not null default ''
);

create index if not exists music_library_review_status_idx
  on public.music_library_inventory(review_status);

create index if not exists music_library_title_idx
  on public.music_library_inventory(title);