import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const commandCenter = read("app/admin/page.jsx");
const commandRoute = read("app/api/admin/operations-summary/route.js");
const commandData = read("lib/operationsSummary.js");
const capabilities = read("lib/staffCapabilities.js");
const forms = read("lib/formOperations.js");
const formsWorkspace = read("app/admin/forms/FormsWorkspace.jsx");
const instrumentPortal = read("app/portal/review/InstrumentRequestSection.jsx");
const instrumentRoute = read("app/api/portal/instrument-request/route.js");
const billing = read("app/admin/billing/page.jsx");
const billingCss = read("app/admin/billing/billing.module.css");
const studentsPage = read("app/admin/students/page.jsx");
const students = read("app/admin/students/CurrentStudentsWorkspace.jsx");
const onboarding = read("app/portal/onboarding/OnboardingClient.jsx");
const guardianFields = read("app/portal/onboarding-prototype/FamilyStep.jsx");
const systemPage = read("app/admin/system/page.jsx");
const systemRoute = read("app/api/admin/system/route.js");
const systemCss = read("app/admin/system/system.module.css");
const manageStudents = read("app/admin/students/manage/page.jsx");
const manageStudentsCss = read("app/admin/students/manage/manage.module.css");
const studentsRoute = read("app/api/admin/students/route.js");
const studentsCss = read("app/admin/current-students-prototype/current-students-prototype.module.css");
const broadcast = read("app/admin/broadcast/page.jsx");

test("the command center presents eight capability-gated operational areas from one protected live summary", () => {
  for (const area of ["students", "attendance", "financial", "forms", "assets", "ensembles", "calendar", "communication"]) {
    assert.match(commandCenter, new RegExp(`id: "${area}"`));
  }
  assert.match(commandCenter, /\/api\/admin\/operations-summary/);
  assert.match(commandCenter, /SPONSORSHIP_READ/);
  assert.match(commandRoute, /authorizeStaffRequest\([\s\S]*STAFF_CAPABILITIES\.OPERATIONS_SUMMARY_READ[\s\S]*safeCapabilityOnly:\s*true/);
  assert.doesNotMatch(commandRoute, /validateStaffRequest/);
  assert.match(capabilities, /OPERATIONS_SUMMARY_READ: "operations\.summary\.read"/);
  assert.match(commandData, /loadCurrentStudents\("active"\)/);
  assert.match(commandData, /loadProgramAttendanceWorkspace/);
  assert.match(commandData, /loadFinancialOperations/);
  assert.match(commandData, /loadFormOperations/);
  assert.match(commandData, /loadProgramMemberships/);
});

test("school instrument acknowledgement completion stays separate from fulfillment", () => {
  assert.match(forms, /state: request\.responsibility_accepted \? "complete" : "submitted"/);
  assert.match(forms, /completedAt: request\.responsibility_accepted \? request\.submitted_at : null/);
  assert.match(forms, /fulfillmentLabel/);
  assert.match(forms, /actionHref: request\.status === "submitted" \? "\/admin\/instrument-inventory"/);
  assert.match(formsWorkspace, /row\.fulfillmentLabel/);
  assert.match(formsWorkspace, /row\.actionHref \? <Link/);
  assert.match(instrumentRoute, /ashleybands_interim_instrument_acknowledgement_v1/);
  assert.doesNotMatch(instrumentPortal, /NHCS instrument responsibility agreement/i);
  assert.match(instrumentPortal, /final county checkout language is confirmed/i);
});

test("student-scoped billing uses student totals and removes program-wide actions", () => {
  assert.match(billing, /const totalRows = useMemo\(\(\) => studentScope \? roster\.filter/);
  assert.match(billing, /\{studentScope \? "Student totals" : "Program totals"\}/);
  assert.match(billing, /!studentScope \? <BulkCharge/);
  assert.match(billing, /!studentScope \? <button onClick=\{exportCsv\}/);
  assert.match(billing, /window\.history\.replaceState\(null, "", "\/admin\/billing"\)/);
  assert.match(billingCss, /@media \(max-width: 700px\)/);
  assert.match(billingCss, /content: attr\(data-label\)/);
});

test("current-student selection, filters, and sort survive URL round trips", () => {
  for (const name of ["initialView", "initialStudentId", "initialSearch", "initialGrade", "initialEnsemble", "initialInstrument", "initialNeed", "initialSort"]) {
    assert.match(studentsPage, new RegExp(name));
  }
  for (const key of ["student", "q", "grade", "ensemble", "instrument", "need", "sort"]) {
    assert.match(students, new RegExp(`params\\.set\\("${key}"`));
  }
  assert.match(students, /\/admin\/students\$\{query \? `\?\$\{query\}` : ""\}/);
});

test("Guardian 1 relationship blocks onboarding save until it is present", () => {
  assert.match(onboarding, /guardian1Relationship\.trim\(\)/);
  assert.match(guardianFields, /id=\{key \+ "Relationship"\} required=\{number === 1\}/);
  assert.match(guardianFields, /id=\{key \+ "Name"\} required=\{number === 1\}/);
});

test("system oversight labels only fresh and tied evidence and grants named compatible scopes", () => {
  assert.match(systemPage, /Latest recovery check/);
  assert.match(systemPage, /verification\.target_label === "isolated_pglite_exact_migrations"/);
  assert.match(systemPage, /Typed restore verified/);
  assert.match(systemPage, /Exact migrations and typed records restored in an isolated database/);
  assert.match(systemPage, /typed restore is not recorded/);
  assert.doesNotMatch(systemPage, /Latest isolated restore/);
  assert.match(systemPage, /verification\.backup_run_id === latestBackup\.id/);
  assert.match(systemRoute, /value:\s*event\.occurrence_key/);
  assert.match(systemPage, /scopes:\s*\["attendance_event"\]/);
  assert.match(systemPage, /window\.confirm/);
  assert.match(systemCss, /min-height:44px/);
});

test("student management loads each selected status, groups legacy inactive records, and exposes failures", () => {
  assert.match(manageStudents, /loadStudents\(statusView, queryRef\.current\)/);
  assert.match(manageStudents, /All students/);
  assert.match(manageStudents, /role="alert"/);
  assert.match(studentsRoute, /\["inactive", "inactive-dropped", "inactive-moved"\]/);
  assert.match(manageStudentsCss, /max-width: 520px/);
  assert.match(manageStudentsCss, /min-height: 44px/);
});

test("Student 360 keeps deep links exact and uses only recorded guardian labels", () => {
  assert.match(students, /else if \(focusedId\) openStudent\(focusedId, controller\.signal, \{ reconcileView: true \}\)/);
  assert.match(students, /guardian\.primary \? "Primary contact" : guardian\.relationship/);
  assert.doesNotMatch(students, /Primary \+ emergency/);
  assert.match(students, /Full program calendar/);
  assert.match(students, /Clear selected student/);
  assert.match(studentsCss, /min-height: 44px/);
});

test("broadcast removes expired presets and keeps student-scoped navigation explicit", () => {
  assert.doesNotMatch(broadcast, /OPEN_HOUSE_SUBJECT|Load Open House welcome|2026-08-17_current_classes/);
  assert.match(broadcast, /Clear student scope/);
  assert.match(broadcast, /Back to student/);
  assert.match(broadcast, /Retry unsent/);
  assert.match(broadcast, /url\.searchParams\.delete\("student"\)/);
});
