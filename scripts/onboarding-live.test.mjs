import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const schema = source("supabase/migrations/202608300001_connected_student_onboarding.sql");
const write = source("supabase/migrations/202608300002_connected_onboarding_write.sql");
const api = source("app/api/portal/onboarding/route.js");
const authorization = source("lib/portalAuthorization.js");
const client = source("app/portal/onboarding/OnboardingClient.jsx");
const request = source("app/api/portal/request/route.js");
const detail = source("app/admin/students/CurrentStudentsWorkspace.jsx");

test("onboarding stores connected facts and completion evidence, not a raw answer blob", () => {
  for (const table of [
    "portal_student_profiles", "portal_student_enrollments", "portal_student_music_profiles",
    "portal_student_other_instruments", "portal_student_interests", "portal_student_school_background",
    "portal_support_requests", "portal_onboarding_completions", "portal_onboarding_progress",
  ]) assert.match(schema, new RegExp(`create table if not exists ${table}`));
  assert.doesNotMatch(schema, /answer_blob|answers jsonb/i);
  assert.match(schema, /Versioned completion evidence/);
});

test("onboarding writes are server-only, strongly scoped, transactional, and idempotent", () => {
  assert.match(schema, /assurance_level text not null default 'legacy'/);
  assert.match(authorization, /\["medium", "high"\]\.includes\(relationship\.assurance_level\)/);
  assert.match(write, /security definer/);
  assert.match(write, /pg_advisory_xact_lock/);
  assert.match(write, /portal_onboarding_step_receipts/);
  assert.match(write, /revoke all on function[\s\S]*from public, anon, authenticated/);
  assert.match(write, /insert into audit_log/);
  assert.doesNotMatch(write, /insert into audit_log[\s\S]*p_payload/);
});

test("live onboarding requires a private trusted-session API and supports saved resume", () => {
  assert.match(api, /authorizePortalStudentRequest\(request, studentId, \{ strong: true \}\)/);
  assert.match(api, /private, no-store/);
  assert.match(api, /p_idempotency_key/);
  assert.match(client, /\/api\/portal\/onboarding/);
  assert.match(client, /lastCompletedStep/);
  assert.match(client, /Finish onboarding/);
});

test("new family claims require the exact canonical student email", () => {
  assert.match(request, /studentSchoolEmail/);
  assert.match(request, /\.ilike\("school_email", studentSchoolEmail\)/);
  assert.match(request, /norm\(student\.school_email\) === norm\(studentSchoolEmail\)/);
  assert.doesNotMatch(request, /\.ilike\("legal_last", studentLast\)/);
});

test("pronouns stay optional in authorized student detail, not the roster columns", () => {
  assert.match(detail, /student\.profile\.pronouns/);
  const rosterHeader = detail.slice(0, detail.indexOf("function StudentDetail"));
  assert.doesNotMatch(rosterHeader, /Pronouns/);
});
