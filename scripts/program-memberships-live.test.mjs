import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("app/admin/ensembles/page.jsx", "utf8");
const workspace = readFileSync("app/admin/ensembles/ProgramMembershipsWorkspace.jsx", "utf8");
const route = readFileSync("app/api/admin/program-memberships/route.js", "utf8");
const contactsRoute = readFileSync("app/api/admin/program-memberships/contacts/route.js", "utf8");
const studentAdminRoute = readFileSync("app/api/admin/students/route.js", "utf8");
const reviewRoute = readFileSync("app/api/admin/profile-requests/route.js", "utf8");
const dataLayer = readFileSync("lib/programMemberships.js", "utf8");
const capabilities = readFileSync("lib/staffCapabilities.js", "utf8");
const migration = readFileSync("supabase/migrations/202608300004_program_memberships.sql", "utf8");
const logicUrl = new URL("../app/admin/ensembles/program-memberships.logic.mjs", import.meta.url);
const { compareMembershipStudents, matchesMembershipStudent, sourceLabel } = await import(logicUrl);

test("the live memberships workspace is protected and server HTML contains no roster", () => {
  assert.match(workspace, /<StaffGate>/);
  assert.match(route, /MEMBERSHIPS_READ/);
  assert.match(capabilities, /MEMBERSHIPS_READ:\s*"memberships\.read"/);
  assert.doesNotMatch(page, /portal_students|displayName|school_email/);
});

test("program membership and school class enrollment are separate temporal records", () => {
  assert.match(migration, /create table if not exists program_memberships/);
  assert.match(migration, /create table if not exists student_class_enrollments/);
  assert.match(migration, /where ends_on is null/);
  assert.match(migration, /A class sync must never mutate program_memberships/);
  assert.match(migration, /reconcile_program_memberships_from_roster/);
  assert.match(migration, /event_type, effective_at, changed_by/);
  assert.doesNotMatch(migration, /concert-band-class-2026-27/);
  assert.match(dataLayer, /student\.status|\.eq\("status", "active"\)/);
  assert.match(dataLayer, /activeStudentIds\.has/);
});

test("class projections are labeled accurately and never presented as an official live feed", () => {
  assert.equal(sourceLabel("bdos_csv_projection"), "Roster projection");
  assert.match(workspace, /No section import connected/);
  assert.match(workspace, /Imported · synced/);
  assert.match(workspace, /Class enrollment does not automatically change AshleyBands program membership/);
  assert.doesNotMatch(workspace, /Official source/);
});

test("roster filters combine with AND semantics and sorting is independent", () => {
  const student = { id: "1", displayName: "Avery North", legalName: "Avery North", grade: "10", instrument: "Percussion", groupIds: ["wind", "marching"], sectionIds: ["advanced"] };
  assert.equal(matchesMembershipStudent(student, { search: "avery", groupIds: ["wind", "marching"], sectionId: "advanced", grade: "10", instrument: "Percussion", groupNames: ["Wind Ensemble", "Marching Band"], sectionNames: ["Wind Ensemble"] }), true);
  assert.equal(matchesMembershipStudent(student, { search: "avery", groupIds: ["wind", "trip"], sectionId: "advanced", grade: "10", instrument: "Percussion", groupNames: ["Wind Ensemble", "Marching Band"], sectionNames: ["Wind Ensemble"] }), false);
  const students = [
    student,
    { ...student, id: "2", displayName: "Zoey Alpha", legalName: "Zoey Alpha", grade: "9", groupIds: [] },
  ];
  assert.deepEqual([...students].sort((a, b) => compareMembershipStudents(a, b, "last")).map((item) => item.displayName), ["Zoey Alpha", "Avery North"]);
});

test("contact export is separately authorized, active-only, bounded, and audited", () => {
  assert.match(contactsRoute, /CONTACTS_EXPORT/);
  assert.match(contactsRoute, /studentIds\.length > 250/);
  assert.match(contactsRoute, /Choose students, guardians, or both/);
  assert.match(contactsRoute, /contact_export/);
  assert.match(contactsRoute, /logAuditRequired/);
  assert.match(dataLayer, /\.eq\("status", "active"\)/);
  assert.match(dataLayer, /\.in\("assurance_level", \["medium", "high"\]\)/);
  assert.match(dataLayer, /person_type === "guardian"/);
  assert.match(dataLayer, /CLOSED_CONTACT_STATUSES/);
  assert.doesNotMatch(route, /portal_contact_methods|guardian/i);
});

test("the accepted navigation paths remain connected", () => {
  assert.match(workspace, /Build a roster/);
  assert.match(workspace, /Activity, team, or trip/);
  assert.match(workspace, /params\.set\("ensemble"/);
  assert.match(workspace, /params\.set\("activity"/);
  assert.match(workspace, /Needs attention/);
  assert.match(workspace, /Copy students \+ guardians/);
  assert.match(workspace, /\/admin\/students\?student=/);
  assert.doesNotMatch(workspace, /attendance-workspace-prototype\?student=/);
  assert.doesNotMatch(workspace, /assets-inventory-prototype\?student=/);
  assert.match(workspace, /\/admin\/attendance\?student=/);
  assert.match(workspace, /scrollIntoView/);
  assert.match(workspace, /Back to membership results/);
});

test("roster sync and approved participation changes use the normalized reconciliation path", () => {
  const sync = readFileSync("scripts/sync-portal-csv.mjs", "utf8");
  const review = readFileSync("app/api/admin/profile-requests/route.js", "utf8");
  assert.match(sync, /rpc\("reconcile_program_memberships_from_roster"\)/);
  assert.match(review, /rpc\("portal_apply_participation_change"/);
  assert.match(migration, /marching_role_category_2026[^\n]*'Color Guard Member'|color guard member/);
  assert.match(migration, /marching_2026[^\n]*in \('yes', 'active', 'marching', 'true', '1'\)/);
});

test("director-only membership mutations reject the sponsorship-only role by capability", () => {
  assert.match(studentAdminRoute, /STUDENTS_WRITE/);
  assert.match(reviewRoute, /MEMBERSHIPS_WRITE/);
  const sponsorLead = capabilities.match(/sponsor_lead:\s*\[([\s\S]*?)\],/i)?.[1] || "";
  assert.match(sponsorLead, /sponsorship\.read/);
  assert.match(sponsorLead, /sponsorship\.write/);
  assert.doesNotMatch(sponsorLead, /students\.|memberships\./);
});
