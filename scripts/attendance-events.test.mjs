import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildOccurrenceKey,
  buildAttendanceReport,
  buildStaffAttendance,
  buildStudentAttendance,
  canManageAttendanceExceptions,
  configuredAttendanceOccurrences,
  groupAttendanceOccurrencesByWeek,
  localEventTimeToIso,
  selectAttendanceOccurrence
} from "../lib/attendanceEvents.mjs";

const projectedCalendar = JSON.parse(readFileSync(
  new URL("../public/calendar-data.json", import.meta.url),
  "utf8"
));

const calendar = [
  { id: "evt-0007", title: "Band Camp (week 1)", start: "2026-08-03T07:00", end: "2026-08-03T15:00" },
  { id: "evt-0007", title: "Band Camp (week 1)", start: "2026-08-04T07:00", end: "2026-08-04T15:00" },
  { id: "evt-0008", title: "Band Camp (week 2)", start: "2026-08-04T18:00", end: "2026-08-04T21:00" },
  { id: "evt-public", title: "Public concert", start: "2026-08-04T19:00", end: "2026-08-04T21:00" }
];

test("repeated calendar events have a stable key for each local occurrence date", () => {
  assert.equal(buildOccurrenceKey(calendar[0]), "evt-0007:2026-08-03");
  assert.equal(buildOccurrenceKey(calendar[1]), "evt-0007:2026-08-04");
});

test("only explicitly configured program events become attendance occurrences", () => {
  const occurrences = configuredAttendanceOccurrences(calendar);
  assert.deepEqual(occurrences.map((event) => event.occurrenceKey), [
    "evt-0007:2026-08-03",
    "evt-0007:2026-08-04",
    "evt-0008:2026-08-04"
  ]);
});

test("two configured events on one date remain distinct", () => {
  const occurrences = configuredAttendanceOccurrences(calendar);
  assert.notEqual(occurrences[1].occurrenceKey, occurrences[2].occurrenceKey);
});

test("the authoritative projection provides camp, rehearsal, football, competition, and concert sessions independently", () => {
  const occurrences = configuredAttendanceOccurrences(projectedCalendar);
  assert.equal(occurrences.length, 36);
  assert.deepEqual(
    occurrences
      .filter((event) => ["2026-08-25", "2026-08-27", "2026-08-28"].includes(event.localDate))
      .map((event) => event.occurrenceKey),
    [
      "evt-0108:2026-08-25",
      "evt-0108:2026-08-27",
      "evt-0009:2026-08-28"
    ]
  );
  assert.equal(occurrences.filter((event) => event.calendarEventId === "evt-0108").length, 16);
  assert.equal(occurrences.filter((event) => /^evt-00(09|10|12|16|20|22)$/.test(event.calendarEventId)).length, 6);
  assert.equal(occurrences.filter((event) => ["evt-0019", "evt-0028", "evt-0053"].includes(event.calendarEventId)).length, 3);
});

test("sessions are grouped into Monday-based weeks without losing date order", () => {
  const occurrences = configuredAttendanceOccurrences(projectedCalendar);
  const groups = groupAttendanceOccurrencesByWeek(occurrences);
  const openingSeasonWeek = groups.find((group) => group.weekStart === "2026-08-24");
  assert.deepEqual(openingSeasonWeek.occurrences.map((event) => event.localDate), [
    "2026-08-25",
    "2026-08-27",
    "2026-08-28"
  ]);
});

test("today defaults to the active or next configured occurrence when two share a date", () => {
  const occurrences = configuredAttendanceOccurrences(calendar);
  const selected = selectAttendanceOccurrence(occurrences, {
    now: new Date("2026-08-04T21:00:00.000Z")
  });
  assert.equal(selected.occurrenceKey, "evt-0008:2026-08-04");
});

test("New York's current day wins even when UTC is already tomorrow", () => {
  const occurrences = configuredAttendanceOccurrences(calendar);
  const selected = selectAttendanceOccurrence(occurrences, {
    now: new Date("2026-08-04T02:30:00.000Z")
  });
  assert.equal(selected.occurrenceKey, "evt-0007:2026-08-03");
});

test("an explicit occurrence key overrides today's default", () => {
  const occurrences = configuredAttendanceOccurrences(calendar);
  const selected = selectAttendanceOccurrence(occurrences, {
    occurrenceKey: "evt-0007:2026-08-04",
    now: new Date("2026-08-03T15:00:00.000Z")
  });
  assert.equal(selected.occurrenceKey, "evt-0007:2026-08-04");
});

test("shared-PIN leaders cannot approve planned exceptions", () => {
  assert.equal(canManageAttendanceExceptions({ access: "shared_pin" }), false);
  assert.equal(canManageAttendanceExceptions({ access: "staff" }), true);
});

test("an approved early-departure plan does not create an observed status or departure", () => {
  const student = buildStudentAttendance(
    { id: "student-1", display_name: "Alex Student" },
    null,
    [{ kind: "early_departure", approval_state: "approved", expected_at: "2026-08-04T17:00:00.000Z" }]
  );
  assert.equal(student.status, null);
  assert.equal(student.departedAt, null);
  assert.equal(student.exceptions.length, 1);
});

test("a recorded local departure time is stored as the correct New York instant", () => {
  assert.equal(
    localEventTimeToIso("2026-08-04", "13:15"),
    "2026-08-04T17:15:00.000Z"
  );
});

test("staff attendance keeps the event-specific status, times, assignment, and notes", () => {
  const staff = buildStaffAttendance(
    { id: "staff-1", display_name: "Alex Director", role: "director" },
    {
      id: "record-1",
      staff_id: "staff-1",
      display_name: "Alex Director",
      status: "left_early",
      arrived_at: "2026-08-28T20:45:00.000Z",
      departed_at: "2026-08-29T00:15:00.000Z",
      role_assignment: "Front ensemble",
      work_notes: "Loaded the synth and mixer."
    }
  );
  assert.equal(staff.key, "staff:staff-1");
  assert.equal(staff.status, "left_early");
  assert.equal(staff.roleAssignment, "Front ensemble");
  assert.equal(staff.workNotes, "Loaded the synth and mixer.");
});

test("the director report keeps plans and actual departures visibly separate", () => {
  const report = buildAttendanceReport({
    event: { title: "Band Camp (week 1)", localDate: "2026-08-04" },
    students: [{
      name: "Alex Student",
      section: "Clarinet",
      grade: "10",
      status: "present",
      note: "Checked in with leadership.",
      departedAt: "2026-08-04T17:15:00.000Z"
    }],
    exceptions: [{
      studentName: "Alex Student",
      kind: "early_departure",
      expected_at: "2026-08-04T17:00:00.000Z",
      note: "Appointment"
    }],
    staff: [{
      name: "Alex Director",
      status: "late",
      arrivedAt: "2026-08-04T16:15:00.000Z",
      departedAt: null,
      roleAssignment: "Front ensemble",
      workNotes: "Covered synth setup."
    }]
  });
  assert.equal(report.departedCount, 1);
  assert.equal(report.exceptionCount, 1);
  assert.equal(report.staffCount, 1);
  assert.match(report.details.join("\n"), /ACTUAL DEPARTURE/);
  assert.match(report.details.join("\n"), /APPROVED EARLY DEPARTURE/);
  assert.match(report.details.join("\n"), /STAFF LATE: Alex Director/);
});
