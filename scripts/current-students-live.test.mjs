import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("app/admin/students/page.jsx", "utf8");
const workspace = readFileSync("app/admin/students/CurrentStudentsWorkspace.jsx", "utf8");
const listRoute = readFileSync("app/api/admin/current-students/route.js", "utf8");
const detailRoute = readFileSync("app/api/admin/current-students/[id]/route.js", "utf8");
const exportRoute = readFileSync("app/api/admin/current-students/export/route.js", "utf8");
const dataLayer = readFileSync("lib/currentStudents.js", "utf8");
const capabilities = readFileSync("lib/staffCapabilities.js", "utf8");
const managePage = readFileSync("app/admin/students/manage/page.jsx", "utf8");
const logicUrl = new URL("../app/admin/students/current-students.logic.mjs", import.meta.url);
const { compareStudents, contactReady, emailValuesForStudents } = await import(logicUrl);

test("the live roster is protected and its server page contains no student values", () => {
  assert.match(workspace, /<StaffGate>/);
  assert.match(listRoute, /STUDENTS_READ/);
  assert.match(detailRoute, /STUDENTS_READ/);
  assert.match(capabilities, /director:\s*\["\*"\]/);
  assert.doesNotMatch(page, /supabase|school_email|guardian/i);
});

test("current students are the default and inactive records require an explicit view", () => {
  assert.match(listRoute, /requestedView === "inactive" \? "inactive" : "active"/);
  assert.match(dataLayer, /student\.status === "active"/);
  assert.match(dataLayer, /INACTIVE_STATUSES\.includes\(student\.status\)/);
  assert.match(workspace, /Current Students/);
  assert.match(workspace, /Inactive Students/);
});

test("the student read model omits catch-all notes and sensitive lock values", () => {
  assert.doesNotMatch(dataLayer, /portal_students[^\n]*notes|lock_combination|lock_serial/);
  assert.match(dataLayer, /portal_student_resources/);
  assert.match(dataLayer, /locker_number,tuner_number/);
});

test("fees and sponsorship gifts remain separate connected records", () => {
  assert.match(dataLayer, /loadStudentLedgers/);
  assert.match(dataLayer, /from\("sponsor_gifts"\)/);
  assert.match(dataLayer, /confirmedSponsorshipCents/);
  assert.match(dataLayer, /legacySponsorshipCreditCents/);
  assert.match(dataLayer, /campaignRaisedCents = sum\(campaignContributions\) \+ confirmedSponsorshipCents/);
  assert.match(workspace, /title="Program fees and campaign funding"/);
  assert.match(workspace, /label="Fee balance"/);
  assert.match(workspace, /label="Campaign raised"/);
});

test("student detail reads normalized current memberships", () => {
  assert.match(dataLayer, /from\("program_memberships"\)/);
  assert.match(dataLayer, /programMemberships/);
  assert.match(workspace, /student\.programMemberships/);
  assert.match(workspace, /\/admin\/ensembles\?view=students&student=/);
  assert.match(dataLayer, /portal_student_status_events/);
  assert.match(workspace, /Status history/);
});

test("the accepted filtering, sorting, contact, and management paths remain available", () => {
  assert.match(workspace, /Filters combine/);
  assert.match(workspace, /Student \+ guardian/);
  assert.match(workspace, /Export contacts/);
  assert.match(workspace, /\/api\/admin\/current-students\/export/);
  assert.match(exportRoute, /CONTACTS_EXPORT/);
  assert.match(exportRoute, /logAuditRequired/);
  assert.match(exportRoute, /spreadsheetSafe/);
  assert.match(exportRoute, /\^\[=\+\\-@\\t\\r\]/);
  assert.match(workspace, /Manage records/);
  assert.match(managePage, /New student/);

  const students = [
    { displayName: "Zoey Alpha", legalName: "Zoey Marie Alpha", grade: "11", ensembles: ["Wind Ensemble"], programInstrument: "Trumpet", needs: [] },
    { displayName: "Avery Zulu", legalName: "Avery Lee Zulu", grade: "9", ensembles: ["Concert Band"], programInstrument: "Clarinet", needs: ["Contact"] },
  ];
  assert.deepEqual([...students].sort((a, b) => compareStudents(a, b, "last-asc")).map((student) => student.displayName), ["Zoey Alpha", "Avery Zulu"]);
});

test("combined email actions include all linked guardians once", () => {
  const students = [{
    schoolEmail: "student@example.com",
    guardians: [
      { emails: ["first@example.com"] },
      { emails: ["second@example.com", "first@example.com"] },
    ],
  }];
  assert.deepEqual(emailValuesForStudents(students, "both"), ["student@example.com", "first@example.com", "second@example.com"]);
  assert.equal(contactReady({ schoolEmail: "student@example.com", guardians: [{ emails: ["family@example.com"], phones: ["9105550000"] }] }), true);
});
