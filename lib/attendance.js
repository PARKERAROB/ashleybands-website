import calendarData from "@/public/calendar-data.json";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { attendanceSectionForStudent, compareMarchingSections } from "@/lib/marchingBandOrder";
import {
  ATTENDANCE_TIME_ZONE,
  buildStudentAttendance,
  canManageAttendanceExceptions,
  configuredAttendanceOccurrences,
  localDateAt,
  localEventTimeToIso,
  selectAttendanceOccurrence
} from "@/lib/attendanceEvents.mjs";

const EVENT_SOURCE = "calendar_projection";
const OBSERVATION_SOURCE = "attendance_web";
const EXCEPTION_SOURCE = "attendance_staff";
const VALID_STATUSES = new Set(["present", "tardy", "absent"]);
const VALID_EXCEPTION_KINDS = new Set(["absent", "late_arrival", "early_departure"]);

function displayGrade(value) {
  const grade = String(value || "").trim();
  const described = grade.match(/(?:rising|incoming)\s+(\d{1,2})(?:st|nd|rd|th)?/i);
  if (described) return described[1];
  const numeric = grade.match(/^0?(\d{1,2})$/);
  return numeric ? numeric[1] : (grade || "—");
}

function eventSnapshot(occurrence) {
  return {
    occurrence_key: occurrence.occurrenceKey,
    calendar_event_id: occurrence.calendarEventId,
    title: occurrence.title,
    starts_at: occurrence.startsAt,
    ends_at: occurrence.endsAt,
    source: EVENT_SOURCE
  };
}

function publicEvent(row, now = new Date()) {
  const localDate = localDateAt(new Date(row.starts_at));
  const today = localDateAt(now);
  return {
    id: row.id,
    occurrenceKey: row.occurrence_key,
    calendarEventId: row.calendar_event_id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    localDate,
    isPast: localDate < today,
    timeZone: ATTENDANCE_TIME_ZONE
  };
}

async function materializeConfiguredEvents() {
  const configured = configuredAttendanceOccurrences(calendarData);
  const snapshots = configured.map(eventSnapshot);
  const { error: insertError } = await supabaseAdmin
    .from("attendance_events")
    .upsert(snapshots, { onConflict: "occurrence_key", ignoreDuplicates: true });
  if (insertError) throw insertError;

  const occurrenceKeys = snapshots.map((event) => event.occurrence_key);
  const { data, error } = await supabaseAdmin
    .from("attendance_events")
    .select("id, occurrence_key, calendar_event_id, title, starts_at, ends_at, source")
    .in("occurrence_key", occurrenceKeys)
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function resolveEvent(occurrenceKey, now = new Date()) {
  const rows = await materializeConfiguredEvents();
  const occurrences = rows.map((row) => ({
    ...publicEvent(row, now),
    localStart: row.starts_at
  }));
  const selected = selectAttendanceOccurrence(occurrences, { occurrenceKey, now });
  return { selected, occurrences };
}

async function loadRosterRows() {
  const [confirmedResult, provisionalResult] = await Promise.all([
    supabaseAdmin
      .from("portal_students")
      .select("id, display_name, legal_last, grade_fall26, mb_role_2026, instrument_2026")
      .eq("status", "active")
      .not("mb_role_2026", "is", null),
    supabaseAdmin
      .from("portal_students")
      .select("id, display_name, legal_last, grade_fall26, mb_role_2026, instrument_2026")
      .eq("status", "active")
      .is("mb_role_2026", null)
      .or("notes.ilike.%provisional%,notes.ilike.%pending and not counted%")
  ]);
  if (confirmedResult.error || provisionalResult.error) {
    throw confirmedResult.error || provisionalResult.error;
  }
  const rosterById = new Map();
  for (const student of confirmedResult.data || []) rosterById.set(student.id, student);
  for (const student of provisionalResult.data || []) rosterById.set(student.id, student);
  return Array.from(rosterById.values());
}

export async function getAttendanceSheet({ occurrenceKey, session, now = new Date() }) {
  const [{ selected, occurrences }, roster] = await Promise.all([
    resolveEvent(occurrenceKey, now),
    loadRosterRows()
  ]);
  const [observationsResult, exceptionsResult] = await Promise.all([
    supabaseAdmin
      .from("attendance_observations")
      .select("portal_student_id, status, note, arrived_at, departed_at, updated_at")
      .eq("attendance_event_id", selected.id),
    supabaseAdmin
      .from("attendance_exceptions")
      .select("id, portal_student_id, kind, expected_at, note, approval_state, updated_at")
      .eq("attendance_event_id", selected.id)
      .eq("approval_state", "approved")
  ]);
  if (observationsResult.error || exceptionsResult.error) {
    throw observationsResult.error || exceptionsResult.error;
  }

  const observations = new Map(
    (observationsResult.data || []).map((row) => [row.portal_student_id, row])
  );
  const exceptionsByStudent = new Map();
  for (const exception of exceptionsResult.data || []) {
    const current = exceptionsByStudent.get(exception.portal_student_id) || [];
    current.push(exception);
    exceptionsByStudent.set(exception.portal_student_id, current);
  }
  const studentNames = new Map(roster.map((student) => [student.id, student.display_name]));

  const students = roster
    .map((student) => buildStudentAttendance({
      id: student.id,
      name: student.display_name,
      lastName: student.legal_last || student.display_name,
      grade: displayGrade(student.grade_fall26),
      section: attendanceSectionForStudent({
        role: student.mb_role_2026,
        instrument: student.instrument_2026
      }),
      assignment: student.mb_role_2026 ? null : (student.instrument_2026 || "Placement pending"),
      provisional: !student.mb_role_2026
    }, observations.get(student.id), exceptionsByStudent.get(student.id)))
    .sort((a, b) => compareMarchingSections(a.section, b.section)
      || a.lastName.localeCompare(b.lastName));

  const exceptions = (exceptionsResult.data || []).map((item) => ({
    ...item,
    studentName: studentNames.get(item.portal_student_id) || "Unknown student"
  })).sort((a, b) => a.studentName.localeCompare(b.studentName));

  return {
    event: selected,
    occurrences,
    students,
    exceptions,
    canManageExceptions: canManageAttendanceExceptions(session)
  };
}

async function activeRosterStudent(studentId) {
  const { data: student, error } = await supabaseAdmin
    .from("portal_students")
    .select("id, display_name, mb_role_2026, notes, status")
    .eq("id", studentId)
    .maybeSingle();
  const provisional = /provisional|pending and not counted/i.test(student?.notes || "");
  if (error || !student || student.status !== "active" || (!student.mb_role_2026 && !provisional)) {
    const notFound = new Error("Student is not on the active marching-band roster.");
    notFound.status = 404;
    throw notFound;
  }
  return student;
}

export async function updateAttendanceObservation({ occurrenceKey, studentId, changes, now = new Date() }) {
  const { selected } = await resolveEvent(occurrenceKey, now);
  const student = await activeRosterStudent(studentId);
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("attendance_observations")
    .select("status, note, arrived_at, departed_at")
    .eq("attendance_event_id", selected.id)
    .eq("portal_student_id", student.id)
    .maybeSingle();
  if (existingError) throw existingError;

  const next = {
    status: existing?.status || null,
    note: existing?.note || null,
    arrived_at: existing?.arrived_at || null,
    departed_at: existing?.departed_at || null
  };
  if (Object.prototype.hasOwnProperty.call(changes, "status")) {
    const status = String(changes.status || "").toLowerCase();
    if (status !== "unmarked" && !VALID_STATUSES.has(status)) {
      const invalid = new Error("Choose Present, Tardy, Absent, or Unmarked.");
      invalid.status = 400;
      throw invalid;
    }
    next.status = status === "unmarked" ? null : status;
  }
  if (Object.prototype.hasOwnProperty.call(changes, "note")) {
    next.note = String(changes.note || "").trim().slice(0, 1000) || null;
  }
  for (const [inputKey, column] of [["arrivedTime", "arrived_at"], ["departedTime", "departed_at"]]) {
    if (!Object.prototype.hasOwnProperty.call(changes, inputKey)) continue;
    const localTime = String(changes[inputKey] || "").trim();
    next[column] = localTime ? localEventTimeToIso(selected.localDate, localTime) : null;
  }

  if (!next.status && !next.note && !next.arrived_at && !next.departed_at) {
    const { error } = await supabaseAdmin
      .from("attendance_observations")
      .delete()
      .eq("attendance_event_id", selected.id)
      .eq("portal_student_id", student.id);
    if (error) throw error;
  } else {
    const { error } = await supabaseAdmin
      .from("attendance_observations")
      .upsert({
        attendance_event_id: selected.id,
        portal_student_id: student.id,
        ...next,
        source: OBSERVATION_SOURCE,
        updated_at: now.toISOString()
      }, { onConflict: "attendance_event_id,portal_student_id" });
    if (error) throw error;
  }
  return { event: selected, student, observation: next };
}

export async function saveApprovedAttendanceException({
  occurrenceKey,
  studentId,
  kind,
  expectedTime,
  note,
  session,
  now = new Date()
}) {
  if (!canManageAttendanceExceptions(session)) {
    const forbidden = new Error("Authenticated staff access is required to approve exceptions.");
    forbidden.status = 403;
    throw forbidden;
  }
  if (!VALID_EXCEPTION_KINDS.has(kind)) {
    const invalid = new Error("Choose an approved exception type.");
    invalid.status = 400;
    throw invalid;
  }
  const { selected } = await resolveEvent(occurrenceKey, now);
  const student = await activeRosterStudent(studentId);
  const expectedAt = expectedTime
    ? localEventTimeToIso(selected.localDate, String(expectedTime).trim())
    : null;
  const row = {
    attendance_event_id: selected.id,
    portal_student_id: student.id,
    kind,
    expected_at: expectedAt,
    note: String(note || "").trim().slice(0, 1000) || null,
    approval_state: "approved",
    approved_by_staff_id: session.actor.id,
    approved_at: now.toISOString(),
    source: EXCEPTION_SOURCE,
    updated_at: now.toISOString()
  };
  const { data, error } = await supabaseAdmin
    .from("attendance_exceptions")
    .upsert(row, { onConflict: "attendance_event_id,portal_student_id,kind" })
    .select("id, portal_student_id, kind, expected_at, note, approval_state, updated_at")
    .single();
  if (error) throw error;
  return { event: selected, student, exception: data };
}

export function attendanceAuditTables() {
  return "portal_students,attendance_events,attendance_observations,attendance_exceptions";
}
