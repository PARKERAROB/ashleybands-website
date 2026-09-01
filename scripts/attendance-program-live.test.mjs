import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/202608300005_attendance_program_backbone.sql", "utf8");
const attendance = readFileSync("lib/attendance.js", "utf8");
const events = readFileSync("lib/attendanceEvents.mjs", "utf8");
const page = readFileSync("app/attendance/page.jsx", "utf8");
const client = readFileSync("app/attendance/AttendanceClient.jsx", "utf8");
const reportRoute = readFileSync("app/api/attendance/report/route.js", "utf8");
const attendanceRoute = readFileSync("app/api/attendance/route.js", "utf8");
const capabilities = readFileSync("lib/staffCapabilities.js", "utf8");

test("program events use normalized group scope and a stable occurrence roster", () => {
  assert.match(migration, /create table if not exists public\.attendance_calendar_groups/);
  assert.match(migration, /create table if not exists public\.attendance_event_roster/);
  assert.match(migration, /create table if not exists public\.attendance_event_roster_groups/);
  assert.match(migration, /reconcile_attendance_event_roster/);
  assert.match(migration, /program_memberships membership/);
  assert.match(migration, /membership\.ends_on is null/);
  assert.match(migration, /student\.status[^\n]*active/);
  assert.doesNotMatch(attendance, /notes\.ilike/);
});

test("attendance writes lock the expected roster and reject students outside it", () => {
  assert.match(attendance, /reconcileRoster\(selected, \{ lock: true/);
  assert.match(attendance, /attendance_event_roster/);
  assert.match(attendance, /Student is not in this event's expected roster/);
  assert.match(migration, /foreign key \(attendance_event_id, portal_student_id\)/);
  assert.match(migration, /on delete restrict/);
  assert.doesNotMatch(attendance, /reconcileRoster\(selected, \{ lock: false/);
  assert.match(attendanceRoute, /body\.prepare/);
  assert.match(attendance, /materializeConfiguredEvents\(\{ write: false \}/);
  assert.match(attendance, /resolveEvent\(occurrenceKey, now, \{ materialize: true \}\)/);
});

test("historical evidence stays visibly incomplete instead of borrowing today's roster", () => {
  assert.match(migration, /observed_record_only/);
  assert.match(migration, /Existing attendance observation or approved exception/);
  assert.match(migration, /roster_locked_at = coalesce/);
  assert.doesNotMatch(attendance, /active marching-band roster/);
  assert.match(migration, /roster_certification_state/);
  assert.match(migration, /certify_attendance_event_roster/);
  assert.match(attendance, /rosterCertificationState === "certified"/);
});

test("concert and marching series share canonical calendar identity but not roster inference", () => {
  assert.match(events, /ATTENDANCE_EVENT_GROUP_CODES/);
  assert.match(events, /"evt-0019"[^\n]*concert-band-2026-27/);
  assert.match(events, /"evt-0108"[^\n]*marching-band-2026/);
  assert.match(events, /buildOccurrenceKey/);
  assert.match(migration, /attendance_calendar_groups/);
});

test("the field tool honors occurrence and student URL context", () => {
  assert.match(page, /initialOccurrenceKey/);
  assert.match(page, /initialStudentId/);
  assert.match(client, /popstate/);
  assert.match(client, /scrollIntoView/);
  assert.match(client, /params\.set\("occurrence"/);
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(client, /AttendanceGate/);
  assert.match(client, /\/api\/attendance\/access/);
  assert.doesNotMatch(client, /StaffGate/);
});

test("report sending requires a named staff capability", () => {
  assert.match(reportRoute, /ATTENDANCE_REPORT_SEND/);
  assert.match(reportRoute, /authorizeStaffRequest/);
  assert.match(capabilities, /ATTENDANCE_REPORT_SEND:\s*"attendance\.report\.send"/);
  assert.doesNotMatch(reportRoute, /validateAttendanceRequest/);
  assert.match(attendanceRoute, /ATTENDANCE_EVENTS_READ/);
  assert.match(attendanceRoute, /validateAttendanceRequest/);
  assert.match(attendanceRoute, /sharedPinFieldOperation/);
  assert.match(attendanceRoute, /prepare:\s*true/);
  assert.match(attendanceRoute, /Named staff access is required for this operation/);
  assert.match(attendanceRoute, /private, no-store/);
  assert.match(attendance, /selected\.lifecycleState === "completed"/);
});

test("completed and corrected event rosters remain explicit", () => {
  assert.match(migration, /complete_attendance_event/);
  assert.match(migration, /adjust_attendance_event_roster/);
  assert.match(migration, /Every expected student must be marked before completion/);
  assert.match(migration, /reconstruction_quality = 'direct_adjustment'/);
  assert.match(migration, /observation\.status is null/);
  assert.match(migration, /reopen_attendance_event/);
  assert.match(migration, /attendance_record_corrections/);
  assert.match(migration, /'event_reopened'/);
  assert.match(migration, /previous_event/);
  assert.match(migration, /attendance_observation_revisions/);
  assert.match(migration, /An attendance event needs at least one expected student before completion/);
  assert.match(migration, /roster_certification_state = 'reconstructing'/);
  assert.match(client, /Complete session/);
});
