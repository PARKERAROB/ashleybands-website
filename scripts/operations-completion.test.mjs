import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  staffHasCapability,
  staffScopeAllows,
  staffUsesAssignedScopes,
} from "../lib/staffCapabilities.js";

const read = (path) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/202608300008_operations_completion.sql");
const studentsRoute = read("app/api/admin/students/route.js");
const portalMe = read("app/api/portal/me/route.js");
const staffAuth = read("lib/staffAuth.js");
const staffAuthorization = read("lib/staffAuthorization.js");
const assetsRoute = read("app/api/admin/assets/route.js");
const formsRoute = read("app/api/admin/forms/route.js");
const formsData = read("lib/formOperations.js");
const refundRoute = read("app/api/billing/forgo-refund/route.js");
const systemRoute = read("app/api/admin/system/route.js");
const systemPage = read("app/admin/system/page.jsx");
const guardianRoute = read("app/api/admin/students/guardians/route.js");

test("student profile and status changes are one attributed database transaction", () => {
  assert.match(migration, /create or replace function public\.transition_student_status_with_audit\(/);
  assert.match(migration, /create or replace function public\.update_student_profile_and_status_with_audit\(/);
  assert.match(migration, /v_to_status not in \('active', 'inactive', 'inactive-graduated'\)/);
  assert.match(migration, /status reason required/);
  assert.match(migration, /authorized active staff actor required/);
  assert.match(migration, /insert into portal_student_status_events[\s\S]*reconcile_program_memberships_from_roster[\s\S]*insert into audit_log/);
  assert.match(migration, /update portal_students set[\s\S]*update_student_profile[\s\S]*transition_student_status_with_audit/);
  assert.match(migration, /portal_set_student_status_and_reconcile[\s\S]*actor and reason are required/);
  assert.match(studentsRoute, /requestedStatus.*\|\| "active"/);
  assert.match(studentsRoute, /update_student_profile_and_status_with_audit/);
  assert.doesNotMatch(studentsRoute, /\.from\("portal_students"\)\.update/);
  assert.match(studentsRoute, /statusReason/);
  assert.doesNotMatch(studentsRoute, /rpc\("portal_set_student_status_and_reconcile"/);
  assert.match(portalMe, /portal_students!inner/);
  assert.match(portalMe, /\.eq\("portal_students\.status", "active"\)/);
});

test("limited roles are explicit and unusable without explicit active scope", () => {
  assert.equal(staffHasCapability({ role: "booster_treasurer" }, "billing.read"), true);
  assert.equal(staffHasCapability({ role: "booster_treasurer" }, "students.read"), false);
  assert.equal(staffHasCapability({ role: "event_worker" }, "attendance.events.write"), true);
  assert.equal(staffUsesAssignedScopes({ role: "event_worker" }), true);
  assert.equal(staffUsesAssignedScopes({ role: "program_staff" }), false);
  const assignments = [{ capability: "attendance.events.write", scope_type: "attendance_event", scope_ref: "event-1" }];
  assert.equal(staffScopeAllows(assignments, "attendance.events.write", { type: "attendance_event", ref: "event-1" }), true);
  assert.equal(staffScopeAllows(assignments, "attendance.events.write", { type: "attendance_event", ref: "event-2" }), false);
  assert.match(migration, /create table if not exists public\.staff_scope_assignments/);
  assert.match(migration, /booster_treasurer[\s\S]*event_worker/);
  assert.doesNotMatch(migration, /insert into public\.staff\s*\(/i);
  assert.match(staffAuthorization, /limited staff role requires an explicitly scoped operation/);
  assert.match(staffAuthorization, /staffScopeAllows/);
});

test("staff disable, role, and scope maintenance is director-only and audited", () => {
  assert.match(migration, /add column if not exists disabled_at timestamptz/);
  assert.match(migration, /create or replace function public\.manage_staff_access_with_audit\(/);
  assert.match(migration, /role = 'director' and disabled_at is null/);
  assert.match(migration, /cannot disable the last active director/);
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\('staff-access-management', 0\)\)/);
  assert.match(migration, /disabled_by_staff_id = p_actor_staff_id,[\s\S]*session_token = gen_random_uuid\(\)/);
  assert.match(migration, /set role = p_role, session_token = gen_random_uuid\(\)/);
  assert.match(migration, /'role', jsonb_build_object\('old', v_target_role, 'new', v_new_role\)/);
  assert.match(migration, /'staff_access_' \|\| v_action/);
  assert.match(migration, /grant_scope[\s\S]*end_scope/);
  assert.match(staffAuth, /\.is\("disabled_at", null\)/);
  assert.match(migration, /grant execute on function public\.manage_staff_access_with_audit[^;]+to service_role/);
  assert.match(systemRoute, /STAFF_CAPABILITIES\.SYSTEM_OVERSIGHT_READ/);
  assert.match(systemRoute, /STAFF_CAPABILITIES\.STAFF_ACCESS_WRITE/);
  assert.match(systemRoute, /manage_staff_access_with_audit/);
  assert.match(systemPage, /Audit, recovery & staff access/);
});

test("staff guardian creation is one attributed database operation", () => {
  assert.match(migration, /create or replace function public\.staff_add_guardian_with_audit\(/);
  assert.match(migration, /insert into portal_people[\s\S]*insert into portal_contact_methods[\s\S]*insert into portal_student_people[\s\S]*insert into audit_log/);
  assert.match(migration, /guardian contact matches multiple people/);
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\('guardian-email:'/);
  assert.match(migration, /'high','staff_grant',now\(\),p_actor_staff_id::text/);
  assert.match(migration, /matched_existing_identity/);
  assert.match(guardianRoute, /rpc\("staff_add_guardian_with_audit"/);
  assert.doesNotMatch(guardianRoute, /\.from\("portal_people"\)/);
});

test("asset extensions preserve source boundaries and lifecycle operations are durable", () => {
  for (const table of ["asset_lockers", "asset_tuners", "asset_music", "asset_uniforms"]) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
  }
  assert.match(migration, /if new\.asset_type = 'locker'[\s\S]*elsif new\.asset_type = 'tuner'/);
  assert.doesNotMatch(migration, /insert into (?:public\.)?asset_(?:music|uniforms)/);
  assert.match(migration, /create or replace function public\.record_asset_operation_with_audit\(/);
  for (const operation of ["assign", "transfer", "return", "condition", "missing"]) {
    assert.match(migration, new RegExp(`'${operation}'`));
  }
  assert.match(migration, /insert into asset_events[\s\S]*insert into audit_log/);
  assert.match(assetsRoute, /asset_events/);
  assert.match(assetsRoute, /asset_relationships/);
  assert.match(assetsRoute, /record_asset_operation_with_audit/);
});

test("non-portal form evidence is written atomically with state and returned in history", () => {
  assert.match(migration, /create or replace function public\.record_form_submission_with_reference\(/);
  assert.match(migration, /set_student_form_requirement_state\([\s\S]*insert into form_submission_references[\s\S]*insert into audit_log/);
  assert.match(migration, /completion mode does not match form version/);
  assert.match(formsRoute, /record_form_submission_with_reference/);
  assert.match(formsRoute, /p_reference_type/);
  assert.match(formsData, /form_submission_references/);
  assert.match(formsData, /references:/);
});

test("spring trip refund choice has one database transaction and idempotent payment identity", () => {
  assert.match(migration, /create or replace function public\.apply_spring_trip_refund_choice\(/);
  assert.match(migration, /from spring_trip_refund_credits[\s\S]*for update/);
  assert.match(migration, /insert into fee_payments[\s\S]*on conflict \(invoice_id\) do nothing[\s\S]*update spring_trip_refund_credits/);
  assert.match(migration, /trusted active guardian required/);
  assert.match(refundRoute, /rpc\("apply_spring_trip_refund_choice"/);
  assert.doesNotMatch(refundRoute, /\.from\("spring_trip_refund_credits"\)\s*\.update/);
  assert.doesNotMatch(refundRoute, /\.from\("fee_payments"\)\.insert/);
});

test("backup and restore evidence is protected metadata, not invented proof", () => {
  for (const table of ["backup_runs", "restore_verifications"]) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`revoke all privileges on table public\\.${table} from anon, authenticated`));
  }
  assert.match(migration, /manifest_sha256/);
  assert.match(migration, /object_count/);
  assert.match(migration, /row_count/);
  assert.match(migration, /verification_sha256/);
  assert.match(migration, /backup_runs_source_ref_unique_idx/);
  assert.match(systemRoute, /backup_runs/);
  assert.match(systemRoute, /restore_verifications/);
});
