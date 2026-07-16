-- provenance: staff-entered Band Shoppe uniform measurements (source='staff_manual').
-- Not family-owned, not CSV-synced (excluded from sync-portal-csv guard), no portal
-- auto-approve path -- this is staff admin data, written only through
-- /api/admin/measurements behind validateStaffRequest, and audited via lib/auditLog.js
-- like every other admin write. Head size intentionally excluded (Rob 2026-07-15).
-- Jacket/pants/hat/gauntlet are Band Shoppe "office use" sizes the vendor derives from
-- these measurements -- not captured here.
--
-- One current row per student (unique student_id); re-measures overwrite and the prior
-- values are preserved in audit_log via the update-diff. All measurement fields are
-- nullable so staff can save partial measurements and finish later.

create table if not exists portal_student_measurements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references portal_students(id) on delete cascade,
  gender text,
  height text,                    -- as entered, e.g. "5-9"
  weight_lbs numeric(5,1),
  chest_in numeric(4,1),
  waist_in numeric(4,1),
  hips_in numeric(4,1),
  inseam_in numeric(4,1),
  back_length_in numeric(4,1),
  girth_in numeric(4,1),
  notes text,
  source text not null default 'staff_manual',
  measured_by text,               -- staff display_name at time of entry
  measured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id)
);

create index if not exists portal_student_measurements_student_idx
  on portal_student_measurements (student_id);

-- RLS on, zero policies: only the service-role key (supabaseAdmin) reaches it, the same
-- posture as audit_log and every other admin table. App-layer validateStaffRequest is
-- the actual gate.
alter table portal_student_measurements enable row level security;
