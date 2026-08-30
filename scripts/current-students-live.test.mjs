import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("app/admin/students/page.jsx", "utf8");
const workspace = readFileSync("app/admin/students/CurrentStudentsWorkspace.jsx", "utf8");
const listRoute = readFileSync("app/api/admin/current-students/route.js", "utf8");
const detailRoute = readFileSync("app/api/admin/current-students/[id]/route.js", "utf8");
const dataLayer = readFileSync("lib/currentStudents.js", "utf8");
const authorization = readFileSync("lib/staffAuthorization.js", "utf8");
const managePage = readFileSync("app/admin/students/manage/page.jsx", "utf8");
const logicUrl = new URL("../app/admin/students/current-students.logic.mjs", import.meta.url);
const { compareStudents, contactReady, emailValuesForStudents } = await import(logicUrl);

test("the live roster is protected and its server page contains no student values", () => {
  assert.match(workspace, /<StaffGate>/);
  assert.match(listRoute, /STUDENTS_READ/);
  assert.match(detailRoute, /STUDENTS_READ/);
  assert.match(authorization, /director:\s*\["\*"\]/);
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
  assert.match(dataLayer, /creditedSponsorshipCents/);
  assert.match(workspace, /Money is kept in two records/);
});

test("the accepted filtering, sorting, contact, and management paths remain available", () => {
  assert.match(workspace, /Filters combine/);
  assert.match(workspace, /Student \+ guardian/);
  assert.match(workspace, /Export contacts/);
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
