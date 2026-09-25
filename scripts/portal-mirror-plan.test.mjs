import test from "node:test";
import assert from "node:assert/strict";

import {
  familyOverlay,
  mirrorFieldDiff,
  overlayFields,
  plannedPersonUpdate,
  plannedRelationshipUpdate,
  plannedStudentUpdate,
  staffNotesVisibleToFamilies,
  withdrawnSchoolEmailContacts
} from "./lib/portal-mirror-plan.mjs";

// Synthetic fixtures only; no roster data.
const rosterStudent = {
  source_student_id: "student-a",
  legal_first: "Test",
  legal_last: "Student",
  preferred_first: null,
  display_name: "Test Student",
  grade_fall26: "10th Grade",
  instrument_2026: "Flute",
  school_email: "a@student.nhcs.net",
  cell_phone: null,
  notes: "staff note",
  source: "bdos_students_csv",
  source_row_hash: "hash-new"
};
const hostedStudent = { ...rosterStudent, id: "uuid-a", cell_phone: "5550000000", source_row_hash: "hash-old" };
const none = familyOverlay([]);

test("a roster-only column change is provenance, not drift", () => {
  const planned = plannedStudentUpdate(rosterStudent, hostedStudent, none);
  assert.deepEqual(mirrorFieldDiff(planned, hostedStudent), []);
});

test("a roster-owned value change is drift", () => {
  const row = { ...rosterStudent, grade_fall26: "11th Grade" };
  assert.deepEqual(mirrorFieldDiff(plannedStudentUpdate(row, hostedStudent, none), hostedStudent), ["grade_fall26"]);
});

test("null and empty compare equal", () => {
  const hosted = { ...hostedStudent, preferred_first: "" };
  assert.deepEqual(mirrorFieldDiff(plannedStudentUpdate(rosterStudent, hosted, none), hosted), []);
});

test("the sync never writes a family phone", () => {
  assert.equal("cell_phone" in plannedStudentUpdate(rosterStudent, hostedStudent, none), false);
});

test("approved family preferred name and participation are kept", () => {
  const hosted = {
    ...hostedStudent,
    preferred_first: "Tee",
    display_name: "Tee Student",
    instrument_2026: "Piccolo",
    band_period_2026: "2"
  };
  const overlay = familyOverlay([
    { student_id: "uuid-a", field_name: "student_preferred_first", status: "approved" },
    { student_id: "uuid-a", field_name: "participation_bundle", status: "approved" }
  ]);
  const planned = plannedStudentUpdate(rosterStudent, hosted, overlay);
  assert.deepEqual(mirrorFieldDiff(planned, hosted), []);
  assert.deepEqual(
    overlayFields(rosterStudent, planned).sort(),
    ["band_period_2026", "display_name", "instrument_2026", "preferred_first"].sort()
  );
});

test("pending or rejected family requests do not protect a field", () => {
  const hosted = { ...hostedStudent, preferred_first: "Tee", display_name: "Tee Student" };
  const overlay = familyOverlay([{ student_id: "uuid-a", field_name: "student_preferred_first", status: "needs_review" }]);
  assert.deepEqual(mirrorFieldDiff(plannedStudentUpdate(rosterStudent, hosted, overlay), hosted), ["preferred_first", "display_name"]);
});

test("roster staff notes never reach the family notes field", () => {
  const hosted = { ...hostedStudent, notes: "family note" };
  const planned = plannedStudentUpdate({ ...rosterStudent, notes: "private staff note" }, hosted, none);
  assert.equal("notes" in planned, false);
  assert.deepEqual(mirrorFieldDiff(planned, hosted), []);
});

test("a family guardian-name edit is kept", () => {
  const row = { source_person_key: "guardian-email:g@example.test", display_name: "Roster Name", first_name: "Roster", last_name: "Name" };
  const hosted = { ...row, id: "uuid-g", display_name: "Family Name", first_name: "Family", last_name: "Name" };
  const overlay = familyOverlay([{ target_id: "uuid-g", field_name: "edit_guardian", status: "approved" }]);
  assert.deepEqual(mirrorFieldDiff(plannedPersonUpdate(row, hosted, overlay), hosted), []);
  assert.deepEqual(mirrorFieldDiff(plannedPersonUpdate(row, hosted, none), hosted), ["display_name", "first_name"]);
});

const rosterLink = { student_id: "uuid-a", person_id: "uuid-g", role: "guardian", relationship_status: "trusted", primary_contact: false, source: "bdos_parents_csv" };

test("the roster never re-trusts a removed link", () => {
  const hosted = { ...rosterLink, relationship_status: "superseded" };
  const planned = plannedRelationshipUpdate(rosterLink, hosted, none);
  assert.equal(planned.relationship_status, "superseded");
  assert.deepEqual(mirrorFieldDiff(planned, hosted), []);
});

test("a portal-written link keeps the family's primary contact and role", () => {
  const hosted = { ...rosterLink, primary_contact: true, role: "mom", source: "portal_onboarding" };
  const planned = plannedRelationshipUpdate(rosterLink, hosted, none);
  assert.deepEqual(mirrorFieldDiff(planned, hosted), []);
  assert.equal(planned.source, "portal_onboarding");
});

test("a roster-written link takes a roster primary-contact change", () => {
  const hosted = { ...rosterLink, primary_contact: true };
  assert.deepEqual(mirrorFieldDiff(plannedRelationshipUpdate(rosterLink, hosted, none), hosted), ["primary_contact"]);
});

test("a blank roster role does not erase a hosted role", () => {
  const hosted = { ...rosterLink, role: "emergency" };
  assert.equal(plannedRelationshipUpdate({ ...rosterLink, role: null }, hosted, none).role, "emergency");
});

test("finds only unverified roster school addresses the roster withdrew", () => {
  const people = new Map([["p1", "student-a"], ["p2", "student-b"]]);
  const roster = new Map([["student-a", ""], ["student-b", "b@student.nhcs.net"]]);
  const row = (overrides) => ({ person_id: "p1", contact_type: "email", value_normalized: "old@student.nhcs.net", verification_status: "unverified", source: "bdos_students_csv", ...overrides });
  const found = withdrawnSchoolEmailContacts([
    row({}),
    row({ verification_status: "verified_email_code" }),
    row({ verification_status: "superseded" }),
    row({ source: "portal_family_edit" }),
    row({ person_id: "p2", value_normalized: "b@student.nhcs.net" }),
    row({ person_id: "unknown" })
  ], people, roster);
  assert.equal(found.length, 1);
  assert.equal(found[0].person_id, "p1");
});

test("flags roster staff notes and admin stamps in the family notes field", () => {
  const roster = [{ id: "student-a", notes: "Private  staff note" }, { id: "student-b", notes: "" }];
  const flagged = staffNotesVisibleToFamilies([
    { source_student_id: "student-a", notes: "private staff note" },
    { source_student_id: "student-a", notes: "a family note" },
    { source_student_id: "student-b", notes: "Added via admin by Staff" },
    { source_student_id: "student-b", notes: null }
  ], roster);
  assert.equal(flagged.length, 2);
});
