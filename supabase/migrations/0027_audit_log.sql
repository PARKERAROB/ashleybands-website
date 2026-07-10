-- Central audit trail (placement-authority-2026-27, phase 0 build step 2).
--
-- APPEND-ONLY by design: this table is the single place every admin write (and
-- select PII reads) get attributed to who+what+when. It exists because every
-- app DB write goes through the Supabase service-role client (supabaseAdmin),
-- which bypasses RLS and would otherwise show "service_role" as the actor for
-- everything -- see phase0/0.3-audit-trail.md for the full inventory + the
-- build-shape rationale (table + app-level helper, not DB triggers, because a
-- trigger on the service-role connection can't recover which staff member
-- made the request).
--
-- No update/delete grants at the app layer: the table only ever receives
-- INSERTs from lib/auditLog.js. RLS is enabled with zero policies, so nothing
-- reaches it except the service-role key (same posture as every other admin
-- table in this schema).
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_type text not null check (actor_type in ('staff', 'parent', 'system')),
  actor_id text,
  actor_name text,
  action text not null,
  table_name text not null,
  record_id text,
  changes jsonb,
  route text
);

create index if not exists audit_log_table_record_idx on audit_log (table_name, record_id);
create index if not exists audit_log_occurred_at_idx on audit_log (occurred_at desc);
create index if not exists audit_log_actor_idx on audit_log (actor_type, actor_id);

alter table audit_log enable row level security;
-- Intentionally no policies: service-role (supabaseAdmin) bypasses RLS and is
-- the only writer/reader. No anon/authenticated policy is granted.
