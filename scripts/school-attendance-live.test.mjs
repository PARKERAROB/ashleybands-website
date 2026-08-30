import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseAttendanceRegisterPages } from "../lib/infiniteCampusAttendanceParser.mjs";

const migration = readFileSync("supabase/migrations/202608300006_school_attendance_imports.sql", "utf8");
const service = readFileSync("lib/schoolAttendance.js", "utf8");
const route = readFileSync("app/api/admin/attendance/school-import/route.js", "utf8");
const workspace = readFileSync("app/admin/attendance/AttendanceWorkspace.jsx", "utf8");
const preflight = readFileSync("scripts/deploy-preflight.mjs", "utf8");

function item(str, x, y, width = 5) {
  return { str, x, y, width, height: 8 };
}

test("blank register cells never become present marks", () => {
  const page = [
    item("Attendance Register", 20, 560),
    item("08/24/2026 - 08/25/2026", 20, 550),
    item("Generated on 08/30/2026 04:58:07 AM", 20, 540),
    item("Page 1 of 1", 700, 540),
    item("Schedule: Main", 20, 530),
    item("Multiple Terms", 120, 530),
    item("26-27 Eugene Ashley High", 240, 530),
    item("Student Name", 95, 500, 50),
    item("M", 208, 500),
    item("T", 228, 500),
    item("Aug", 205, 510),
    item("25", 225, 510),
    item("1) 52562X0001-11 Band Interm Fall", 20, 480, 160),
    item("1234567890", 50, 460, 40),
    item("Student, Avery Q", 100, 460, 75),
    item("A", 208, 460),
  ];
  const result = parseAttendanceRegisterPages([page]);
  assert.equal(result.marks.length, 1);
  assert.deepEqual(result.marks.map((mark) => [mark.attendanceDate, mark.code]), [["2026-08-24", "A"]]);
  assert.equal(result.dates.length, 2);
  assert.equal(result.generatedAt, "2026-08-30T04:58:07-04:00");
  assert.equal(result.throughDate, "2026-08-25");
});

test("printed headers control multi-window dates across a weekend", () => {
  const common = [
    item("Attendance Register", 20, 560),
    item("08/24/2026 - 09/04/2026", 20, 550),
    item("Generated on 09/05/2026 04:58:07 AM", 20, 540),
    item("Page 1 of 2", 700, 540),
    item("Schedule: Main", 20, 530),
    item("Multiple Terms", 120, 530),
    item("26-27 Eugene Ashley High", 240, 530),
    item("Student Name", 95, 500, 50),
    item("1) 52562X0001-11 Band Interm Fall", 20, 480, 160),
    item("1234567890", 50, 460, 40),
    item("Student, Avery Q", 100, 460, 75)
  ];
  const first = [...common,
    item("M", 208, 500), item("T", 228, 500), item("W", 248, 500),
    item("T", 268, 500), item("F", 288, 500),
    item("Aug", 205, 510), item("25", 225, 510), item("26", 245, 510),
    item("27", 265, 510), item("28", 285, 510), item("A", 288, 460)
  ];
  const second = common.map((entry) => entry.str === "Page 1 of 2"
    ? { ...entry, str: "Page 2 of 2" }
    : entry).concat([
    item("M", 208, 500), item("T", 228, 500), item("W", 248, 500),
    item("T", 268, 500), item("F", 288, 500),
    item("Aug", 205, 510), item("Sep", 225, 510), item("02", 245, 510),
    item("03", 265, 510), item("04", 285, 510), item("T", 208, 460)
  ]);
  const result = parseAttendanceRegisterPages([first, second]);
  assert.deepEqual(result.marks.map((mark) => [mark.attendanceDate, mark.code]), [
    ["2026-08-28", "A"],
    ["2026-08-31", "T"]
  ]);
  assert.equal(result.throughDate, "2026-09-04");
});

test("school attendance retains protected identifiers and separate class enrollment", () => {
  assert.match(migration, /portal_student_external_identifiers/);
  assert.match(migration, /school_attendance_imports/);
  assert.match(migration, /school_attendance_marks/);
  assert.match(migration, /source_generated_at/);
  assert.match(migration, /school_attendance_import_sections_current_idx/);
  assert.match(migration, /on conflict \(file_hash\) do nothing/);
  assert.match(migration, /unique \(authority, identifier_type, student_id\)/);
  assert.match(migration, /nhcs-hash:/);
  assert.match(migration, /nhcs-student:/);
  assert.match(migration, /identifier\.id is null/);
  assert.match(migration, /student_class_enrollments/);
  assert.doesNotMatch(migration, /insert into public\.program_memberships/);
  assert.doesNotMatch(migration, /source_student_number/);
  assert.match(service, /protectedStudentIdentifier/);
  assert.match(service, /confirmed_exact_name/);
  assert.match(service, /manualMappings/);
  assert.doesNotMatch(service, /ATTENDANCE_IDENTIFIER_SECRET \|\|/);
  assert.match(preflight, /ATTENDANCE_IDENTIFIER_SECRET/);
});

test("a dropped and later reappearing class enrollment starts at the new source observation", () => {
  const insertionStart = migration.indexOf("insert into public.student_class_enrollments");
  const insertion = migration.slice(
    insertionStart,
    migration.indexOf("return jsonb_build_object", insertionStart)
  );
  assert.match(insertion, /prior_enrollment\.ends_on is not null/);
  assert.match(insertion, /\(v_generated_at at time zone 'America\/New_York'\)::date/);
  assert.match(insertion, /max\(prior_enrollment\.ends_on\) \+ 1/);
  assert.match(insertion, /else v_period_start/);
  assert.doesNotMatch(
    insertion,
    /select distinct import_section\.linked_section_id, import_roster\.portal_student_id,\s*v_period_start,/
  );

  const dayAfter = (date) => {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + 1);
    return value.toISOString().slice(0, 10);
  };
  const observedReentryStart = (generatedLocalDate, priorEnds) =>
    [generatedLocalDate, dayAfter([...priorEnds].sort().at(-1))].sort().at(-1);

  const sameThroughDate = "2026-08-28";
  assert.equal(
    observedReentryStart("2026-08-28", [sameThroughDate]),
    "2026-08-29"
  );
  assert.equal(
    observedReentryStart("2026-09-05", [sameThroughDate]),
    "2026-09-05"
  );
});

test("register acceptance is review-first, private, and staff-authorized", () => {
  assert.match(route, /ATTENDANCE_SCHOOL_IMPORT/);
  assert.match(route, /request\.formData/);
  assert.match(route, /mode === "preview"/);
  assert.match(route, /private, no-store/);
  assert.match(workspace, /Confirm the exact legal-name suggestions/);
  assert.match(workspace, /Infinite Campus remains official/);
  assert.match(workspace, /never changes program or ensemble memberships/);
});
