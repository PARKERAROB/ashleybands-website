import calendarData from "@/public/calendar-data.json";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { attendanceSectionForStudent, compareMarchingSections } from "@/lib/marchingBandOrder";
import {
  ATTENDANCE_TIME_ZONE,
  buildStaffAttendance,
  buildStudentAttendance,
  configuredAttendanceOccurrences,
  localDateAt,
  localEventTimeToIso,
  selectAttendanceOccurrence
} from "@/lib/attendanceEvents.mjs";

const EVENT_SOURCE = "calendar_projection";
const OBSERVATION_SOURCE = "attendance_web";
const EXCEPTION_SOURCE = "attendance_staff";
const VALID_STATUSES = new Set(["present", "tardy", "absent"]);
const VALID_STAFF_STATUSES = new Set(["present", "absent", "late", "left_early"]);
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
    source: EVENT_SOURCE,
    source_revision: occurrence.sourceRevision || null
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
    lifecycleState: row.lifecycle_state || "scheduled",
    rosterLockedAt: row.roster_locked_at || null,
    rosterCertificationState: row.roster_certification_state || "unlocked",
    rosterCertifiedAt: row.roster_certified_at || null,
    rosterCertificationNote: row.roster_certification_note || "",
    completedAt: row.completed_at || null,
    completionNote: row.completion_note || "",
    correctionOpenedAt: row.correction_opened_at || null,
    correctionReason: row.correction_reason || "",
    timeZone: ATTENDANCE_TIME_ZONE
  };
}

async function materializeConfiguredEvents({ write = false } = {}) {
  const configured = configuredAttendanceOccurrences(calendarData);
  const snapshots = configured.map(eventSnapshot);
  if (!write) {
    const { data: stored, error } = await supabaseAdmin
      .from("attendance_events")
      .select("id, occurrence_key, calendar_event_id, title, starts_at, ends_at, source, lifecycle_state, roster_locked_at, roster_certification_state, roster_certified_at, roster_certification_note, completed_at, completion_note, correction_opened_at, correction_reason, source_revision")
      .neq("lifecycle_state", "superseded")
      .order("starts_at", { ascending: true });
    if (error) throw error;
    const byKey = new Map((stored || []).map((row) => [row.occurrence_key, row]));
    for (const snapshot of snapshots) {
      if (!byKey.has(snapshot.occurrence_key)) {
        byKey.set(snapshot.occurrence_key, {
          id: null,
          ...snapshot,
          lifecycle_state: "scheduled",
          roster_locked_at: null,
          roster_certification_state: "unlocked",
          roster_certified_at: null,
          roster_certification_note: null,
          completed_at: null,
          completion_note: null,
          correction_opened_at: null,
          correction_reason: null
        });
      }
    }
    return [...byKey.values()].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }
  const { error: insertError } = await supabaseAdmin
    .from("attendance_events")
    .upsert(snapshots, { onConflict: "occurrence_key", ignoreDuplicates: true });
  if (insertError) throw insertError;

  const occurrenceKeys = snapshots.map((event) => event.occurrence_key);
  const { data: currentRows, error } = await supabaseAdmin
    .from("attendance_events")
    .select("id, occurrence_key, calendar_event_id, title, starts_at, ends_at, source, lifecycle_state, roster_locked_at, roster_certification_state, roster_certified_at, roster_certification_note, completed_at, completion_note, correction_opened_at, correction_reason, source_revision")
    .in("occurrence_key", occurrenceKeys)
    .order("starts_at", { ascending: true });
  if (error) throw error;
  const snapshotByKey = new Map(snapshots.map((item) => [item.occurrence_key, item]));
  for (const row of currentRows || []) {
    const snapshot = snapshotByKey.get(row.occurrence_key);
    if (!snapshot || row.roster_locked_at || !["scheduled", "prepared"].includes(row.lifecycle_state)) continue;
    if (row.title === snapshot.title
      && row.starts_at === snapshot.starts_at
      && row.ends_at === snapshot.ends_at
      && row.source_revision === snapshot.source_revision) continue;
    const { error: updateError } = await supabaseAdmin
      .from("attendance_events")
      .update({
        title: snapshot.title,
        starts_at: snapshot.starts_at,
        ends_at: snapshot.ends_at,
        source: snapshot.source,
        source_revision: snapshot.source_revision,
        updated_at: new Date().toISOString()
      })
      .eq("id", row.id)
      .is("roster_locked_at", null)
      .in("lifecycle_state", ["scheduled", "prepared"]);
    if (updateError) throw updateError;
  }

  const configuredKeys = new Set(occurrenceKeys);
  const configuredCalendarIds = [...new Set(snapshots.map((item) => item.calendar_event_id))];
  const { data: projectedRows, error: projectedError } = await supabaseAdmin
    .from("attendance_events")
    .select("id, occurrence_key, calendar_event_id, title, starts_at, ends_at, source, lifecycle_state, roster_locked_at, roster_certification_state, roster_certified_at, roster_certification_note, completed_at, completion_note, correction_opened_at, correction_reason, source_revision")
    .in("calendar_event_id", configuredCalendarIds);
  if (projectedError) throw projectedError;
  for (const row of projectedRows || []) {
    if (configuredKeys.has(row.occurrence_key)
      || row.roster_locked_at
      || !["scheduled", "prepared"].includes(row.lifecycle_state)) continue;
    const { error: supersedeError } = await supabaseAdmin
      .from("attendance_events")
      .update({ lifecycle_state: "superseded", updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("roster_locked_at", null)
      .in("lifecycle_state", ["scheduled", "prepared"]);
    if (supersedeError) throw supersedeError;
  }

  const { data: refreshed, error: refreshedError } = await supabaseAdmin
    .from("attendance_events")
    .select("id, occurrence_key, calendar_event_id, title, starts_at, ends_at, source, lifecycle_state, roster_locked_at, roster_certification_state, roster_certified_at, roster_certification_note, completed_at, completion_note, correction_opened_at, correction_reason, source_revision")
    .neq("lifecycle_state", "superseded")
    .order("starts_at", { ascending: true });
  if (refreshedError) throw refreshedError;
  return refreshed || [];
}

async function resolveEvent(occurrenceKey, now = new Date(), { materialize = false } = {}) {
  const rows = await materializeConfiguredEvents({ write: materialize });
  let occurrences = rows.map((row) => ({
    ...publicEvent(row, now),
    localStart: row.starts_at
  }));
  if (occurrenceKey && !occurrences.some((event) => event.occurrenceKey === occurrenceKey)) {
    const { data: historical, error } = await supabaseAdmin
      .from("attendance_events")
      .select("id, occurrence_key, calendar_event_id, title, starts_at, ends_at, source, lifecycle_state, roster_locked_at, roster_certification_state, roster_certified_at, roster_certification_note, completed_at, completion_note, correction_opened_at, correction_reason, source_revision")
      .eq("occurrence_key", occurrenceKey)
      .maybeSingle();
    if (error) throw error;
    if (historical) {
      occurrences = [...occurrences, { ...publicEvent(historical, now), localStart: historical.starts_at }]
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    }
  }
  const selected = selectAttendanceOccurrence(occurrences, { occurrenceKey, now });
  return { selected, occurrences };
}

export async function listAttendanceEventRows() {
  return materializeConfiguredEvents({ write: false });
}

async function reconcileRoster(selected, { lock = false, actorStaffId = null } = {}) {
  const { data, error } = await supabaseAdmin.rpc("reconcile_attendance_event_roster", {
    p_event_id: selected.id,
    p_actor_staff_id: actorStaffId,
    p_lock: lock
  });
  if (error) throw error;
  return data;
}

async function loadRosterRows(eventId) {
  if (!eventId) return [];
  const [rosterResult, bridgeResult] = await Promise.all([
    supabaseAdmin
      .from("attendance_event_roster")
      .select("student_id, role_snapshot, reconstruction_quality, portal_students!inner(id, display_name, legal_last, grade_fall26, mb_role_2026, instrument_2026)")
      .eq("attendance_event_id", eventId)
      .eq("roster_state", "included"),
    supabaseAdmin
      .from("attendance_event_roster_groups")
      .select("student_id, program_groups!inner(name, group_type)")
      .eq("attendance_event_id", eventId)
  ]);
  if (rosterResult.error || bridgeResult.error) {
    throw rosterResult.error || bridgeResult.error;
  }
  const groupsByStudent = new Map();
  for (const row of bridgeResult.data || []) {
    const current = groupsByStudent.get(row.student_id) || [];
    if (row.program_groups?.name) current.push(row.program_groups);
    groupsByStudent.set(row.student_id, current);
  }
  return (rosterResult.data || []).map((row) => ({
    ...row.portal_students,
    role_snapshot: row.role_snapshot,
    reconstruction_quality: row.reconstruction_quality,
    groups: groupsByStudent.get(row.student_id) || []
  }));
}

async function loadStaffAttendance(eventId, { includeDirectory = false } = {}) {
  if (!eventId) return [];
  const observationsResult = await supabaseAdmin
      .from("attendance_staff_observations")
      .select("id, staff_id, display_name, status, arrived_at, departed_at, role_assignment, work_notes, updated_at")
      .eq("attendance_event_id", eventId);
  if (observationsResult.error) throw observationsResult.error;
  const membersResult = includeDirectory
    ? await supabaseAdmin.from("staff").select("id, display_name, role").order("display_name", { ascending: true })
    : { data: [], error: null };
  if (membersResult.error) throw membersResult.error;

  const observationsByStaff = new Map();
  const adHoc = [];
  for (const observation of observationsResult.data || []) {
    if (observation.staff_id) observationsByStaff.set(observation.staff_id, observation);
    else adHoc.push(buildStaffAttendance(null, observation));
  }
  const staff = (membersResult.data || []).map((member) =>
    buildStaffAttendance(member, observationsByStaff.get(member.id)));
  if (!includeDirectory) {
    for (const observation of observationsByStaff.values()) {
      staff.push(buildStaffAttendance(null, observation));
    }
  }
  return [...staff, ...adHoc].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAttendanceSheet({ occurrenceKey, session, now = new Date() }) {
  const { selected, occurrences } = await resolveEvent(occurrenceKey, now);
  const roster = await loadRosterRows(selected.id);
  const [observationsResult, exceptionsResult, staff] = selected.id ? await Promise.all([
    supabaseAdmin
      .from("attendance_observations")
      .select("portal_student_id, status, note, arrived_at, departed_at, updated_at")
      .eq("attendance_event_id", selected.id),
    supabaseAdmin
      .from("attendance_exceptions")
      .select("id, portal_student_id, kind, expected_at, note, approval_state, updated_at")
      .eq("attendance_event_id", selected.id)
      .eq("approval_state", "approved"),
    loadStaffAttendance(selected.id, { includeDirectory: Boolean(session?.permissions?.staffWrite) })
  ]) : [{ data: [], error: null }, { data: [], error: null }, []];
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
      section: student.groups.some((group) => group.name === "Marching Band")
        ? attendanceSectionForStudent({
            role: student.role_snapshot || student.mb_role_2026,
            instrument: student.instrument_2026
          })
        : student.groups.map((group) => group.name).sort().join(" + ") || "Program event",
      assignment: student.role_snapshot || student.instrument_2026 || "Placement pending",
      provisional: false,
      rosterQuality: student.reconstruction_quality,
      groups: student.groups.map((group) => group.name).sort()
    }, observations.get(student.id), exceptionsByStudent.get(student.id)))
    .sort((a, b) => compareMarchingSections(a.section, b.section)
      || a.lastName.localeCompare(b.lastName));

  const exceptions = (exceptionsResult.data || []).map((item) => ({
    ...item,
    studentName: studentNames.get(item.portal_student_id) || "Unknown student"
  })).sort((a, b) => a.studentName.localeCompare(b.studentName));
  const rosterCompleteness = !roster.length
    ? "missing"
    : selected.rosterCertificationState === "certified"
      ? "locked"
      : selected.rosterCertificationState === "reconstructing"
        ? "reconstructing"
        : selected.rosterLockedAt
          ? "observed_only"
          : "preview";
  const eventWithRoster = { ...selected, rosterCompleteness };
  const writable = selected.lifecycleState === "open" && rosterCompleteness === "locked";

  return {
    event: eventWithRoster,
    occurrences,
    students,
    staff,
    exceptions,
    canWriteAttendance: Boolean(session?.permissions?.eventsWrite) && writable,
    canManageExceptions: Boolean(session?.permissions?.exceptionsWrite) && writable,
    canManageStaff: Boolean(session?.permissions?.staffWrite) && writable,
    canPrepare: Boolean(session?.permissions?.eventsWrite)
      && !selected.isPast
      && !selected.rosterLockedAt
      && ["scheduled", "prepared"].includes(selected.lifecycleState),
    canComplete: Boolean(session?.permissions?.eventsWrite)
      && writable
      && students.length > 0
      && students.every((student) => Boolean(student.status)),
    canSendReport: Boolean(session?.permissions?.reportSend)
      && rosterCompleteness === "locked"
      && selected.lifecycleState === "completed"
  };
}

async function assertWritableEvent(selected) {
  if (!selected.rosterLockedAt || selected.lifecycleState !== "open") {
    const conflict = new Error("Prepare this attendance session before making changes.");
    conflict.status = 409;
    throw conflict;
  }
  if (selected.rosterCertificationState !== "certified") {
    const conflict = new Error("This historical session has no complete expected-roster snapshot.");
    conflict.status = 409;
    throw conflict;
  }
}

export async function prepareAttendanceEvent({ occurrenceKey, actorStaffId, now = new Date() }) {
  const { selected } = await resolveEvent(occurrenceKey, now, { materialize: true });
  if (selected.isPast) {
    const conflict = new Error("A past event cannot borrow today's program roster.");
    conflict.status = 409;
    throw conflict;
  }
  if (!["scheduled", "prepared"].includes(selected.lifecycleState) || selected.rosterLockedAt) {
    const conflict = new Error("This attendance session is already locked or no longer writable.");
    conflict.status = 409;
    throw conflict;
  }
  const result = await reconcileRoster(selected, { lock: true, actorStaffId });
  if (!result?.rosterCount) {
    const conflict = new Error("No current students are connected to this event's program groups.");
    conflict.status = 409;
    throw conflict;
  }
  return result;
}

export async function completeAttendanceEvent({ occurrenceKey, actorStaffId, note, now = new Date() }) {
  const { selected } = await resolveEvent(occurrenceKey, now);
  await assertWritableEvent(selected);
  const { data, error } = await supabaseAdmin.rpc("complete_attendance_event", {
    p_event_id: selected.id,
    p_actor_staff_id: actorStaffId,
    p_note: String(note || "").trim().slice(0, 500) || null
  });
  if (error) throw error;
  return data;
}

export async function adjustAttendanceEventRoster({
  occurrenceKey,
  studentId,
  include,
  actorStaffId,
  reason,
  now = new Date()
}) {
  const { selected } = await resolveEvent(occurrenceKey, now);
  const { data, error } = await supabaseAdmin.rpc("adjust_attendance_event_roster", {
    p_event_id: selected.id,
    p_student_id: studentId,
    p_include: Boolean(include),
    p_actor_staff_id: actorStaffId,
    p_reason: String(reason || "").trim().slice(0, 500) || null
  });
  if (error) throw error;
  return data;
}

export async function beginHistoricalAttendanceReconstruction({ occurrenceKey, actorStaffId, now = new Date() }) {
  const { selected } = await resolveEvent(occurrenceKey, now, { materialize: true });
  if (!selected.id || !selected.isPast) {
    const invalid = new Error("Choose a stored past event for manual reconstruction.");
    invalid.status = 409;
    throw invalid;
  }
  const { data, error } = await supabaseAdmin.rpc("begin_historical_attendance_reconstruction", {
    p_event_id: selected.id,
    p_actor_staff_id: actorStaffId
  });
  if (error) throw error;
  return data;
}

export async function certifyAttendanceEventRoster({ occurrenceKey, actorStaffId, note, now = new Date() }) {
  const { selected } = await resolveEvent(occurrenceKey, now);
  if (!selected.id) {
    const invalid = new Error("Choose a stored attendance event.");
    invalid.status = 409;
    throw invalid;
  }
  const { data, error } = await supabaseAdmin.rpc("certify_attendance_event_roster", {
    p_event_id: selected.id,
    p_actor_staff_id: actorStaffId,
    p_note: String(note || "").trim().slice(0, 500)
  });
  if (error) throw error;
  return data;
}

export async function reopenAttendanceEvent({ occurrenceKey, actorStaffId, reason, now = new Date() }) {
  const { selected } = await resolveEvent(occurrenceKey, now);
  const { data, error } = await supabaseAdmin.rpc("reopen_attendance_event", {
    p_event_id: selected.id,
    p_actor_staff_id: actorStaffId,
    p_reason: String(reason || "").trim().slice(0, 500)
  });
  if (error) throw error;
  return data;
}

export async function removeAttendanceEventStudentWithRecords({
  occurrenceKey,
  studentId,
  actorStaffId,
  reason,
  now = new Date()
}) {
  const { selected } = await resolveEvent(occurrenceKey, now);
  const { data, error } = await supabaseAdmin.rpc("remove_attendance_event_student_with_records", {
    p_event_id: selected.id,
    p_student_id: studentId,
    p_actor_staff_id: actorStaffId,
    p_reason: String(reason || "").trim().slice(0, 500)
  });
  if (error) throw error;
  return data;
}

function cleanStaffText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength) || null;
}

async function resolveStaffObservation({ selected, recordId, staffId, displayName }) {
  if (recordId) {
    const { data, error } = await supabaseAdmin
      .from("attendance_staff_observations")
      .select("id, attendance_event_id, staff_id, display_name, status, arrived_at, departed_at, role_assignment, work_notes")
      .eq("id", recordId)
      .eq("attendance_event_id", selected.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      const notFound = new Error("Staff attendance entry was not found for this session.");
      notFound.status = 404;
      throw notFound;
    }
    if (!data.staff_id) return { existing: data, member: null };
    const { data: member, error: memberError } = await supabaseAdmin
      .from("staff")
      .select("id, display_name, role")
      .eq("id", data.staff_id)
      .maybeSingle();
    if (memberError) throw memberError;
    return { existing: data, member };
  }

  if (staffId) {
    const [{ data: member, error: memberError }, { data: existing, error: existingError }] = await Promise.all([
      supabaseAdmin
        .from("staff")
        .select("id, display_name, role")
        .eq("id", staffId)
        .maybeSingle(),
      supabaseAdmin
        .from("attendance_staff_observations")
        .select("id, attendance_event_id, staff_id, display_name, status, arrived_at, departed_at, role_assignment, work_notes")
        .eq("attendance_event_id", selected.id)
        .eq("staff_id", staffId)
        .maybeSingle()
    ]);
    if (memberError || existingError) throw memberError || existingError;
    if (!member) {
      const notFound = new Error("Staff member was not found.");
      notFound.status = 404;
      throw notFound;
    }
    return { existing, member };
  }

  const name = cleanStaffText(displayName, 120);
  if (!name) {
    const invalid = new Error("Enter the staff member's name.");
    invalid.status = 400;
    throw invalid;
  }
  return { existing: null, member: { id: null, display_name: name, role: null } };
}

export async function updateStaffAttendance({
  occurrenceKey,
  recordId,
  staffId,
  displayName,
  changes,
  now = new Date()
}) {
  const { selected } = await resolveEvent(occurrenceKey, now);
  await assertWritableEvent(selected);
  const { existing, member } = await resolveStaffObservation({
    selected,
    recordId,
    staffId,
    displayName
  });
  const next = {
    status: existing?.status || null,
    arrived_at: existing?.arrived_at || null,
    departed_at: existing?.departed_at || null,
    role_assignment: existing?.role_assignment || null,
    work_notes: existing?.work_notes || null
  };
  if (Object.prototype.hasOwnProperty.call(changes, "status")) {
    const status = String(changes.status || "").toLowerCase();
    if (status !== "unmarked" && !VALID_STAFF_STATUSES.has(status)) {
      const invalid = new Error("Choose Present, Absent, Late, Left early, or Unmarked.");
      invalid.status = 400;
      throw invalid;
    }
    next.status = status === "unmarked" ? null : status;
  }
  for (const [inputKey, column] of [["arrivedTime", "arrived_at"], ["departedTime", "departed_at"]]) {
    if (!Object.prototype.hasOwnProperty.call(changes, inputKey)) continue;
    const localTime = String(changes[inputKey] || "").trim();
    next[column] = localTime ? localEventTimeToIso(selected.localDate, localTime) : null;
  }
  if (Object.prototype.hasOwnProperty.call(changes, "roleAssignment")) {
    next.role_assignment = cleanStaffText(changes.roleAssignment, 160);
  }
  if (Object.prototype.hasOwnProperty.call(changes, "workNotes")) {
    next.work_notes = cleanStaffText(changes.workNotes, 500);
  }

  const resolvedStaffId = existing?.staff_id || member?.id || null;
  const resolvedName = existing?.display_name || member?.display_name;
  const hasDetails = next.status || next.arrived_at || next.departed_at
    || next.role_assignment || next.work_notes;
  if (existing && resolvedStaffId && !hasDetails) {
    const { error } = await supabaseAdmin
      .from("attendance_staff_observations")
      .delete()
      .eq("id", existing.id)
      .eq("attendance_event_id", selected.id);
    if (error) throw error;
    return {
      event: selected,
      staffAttendance: buildStaffAttendance(member || {
        id: resolvedStaffId,
        display_name: resolvedName,
        role: null
      }, null)
    };
  }

  const row = {
    attendance_event_id: selected.id,
    staff_id: resolvedStaffId,
    display_name: resolvedName,
    ...next,
    source: OBSERVATION_SOURCE,
    updated_at: now.toISOString()
  };
  const query = existing
    ? supabaseAdmin.from("attendance_staff_observations").update(row).eq("id", existing.id)
    : supabaseAdmin.from("attendance_staff_observations").insert(row);
  const { data, error } = await query
    .select("id, staff_id, display_name, status, arrived_at, departed_at, role_assignment, work_notes, updated_at")
    .single();
  if (error) throw error;
  return {
    event: selected,
    staffAttendance: buildStaffAttendance(member, data)
  };
}

async function eventRosterStudent(eventId, studentId) {
  const { data: roster, error } = await supabaseAdmin
    .from("attendance_event_roster")
    .select("student_id, portal_students!inner(id, display_name, status)")
    .eq("attendance_event_id", eventId)
    .eq("student_id", studentId)
    .eq("roster_state", "included")
    .maybeSingle();
  if (error || !roster?.portal_students) {
    const notFound = new Error("Student is not in this event's expected roster.");
    notFound.status = 404;
    throw notFound;
  }
  return roster.portal_students;
}

export async function updateAttendanceObservation({ occurrenceKey, studentId, changes, actorStaffId, now = new Date() }) {
  const { selected } = await resolveEvent(occurrenceKey, now);
  await assertWritableEvent(selected);
  const student = await eventRosterStudent(selected.id, studentId);
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

  if (selected.correctionOpenedAt) {
    const { error } = await supabaseAdmin.rpc("correct_attendance_observation", {
      p_event_id: selected.id,
      p_student_id: student.id,
      p_actor_staff_id: actorStaffId,
      p_status: next.status,
      p_note: next.note,
      p_arrived_at: next.arrived_at,
      p_departed_at: next.departed_at
    });
    if (error) throw error;
    return { event: selected, student, observation: next };
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
  if (!session?.permissions?.exceptionsWrite) {
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
  await assertWritableEvent(selected);
  const student = await eventRosterStudent(selected.id, studentId);
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
  return "portal_students,staff,attendance_events,attendance_calendar_groups,attendance_event_roster,attendance_event_roster_groups,attendance_observations,attendance_exceptions,attendance_staff_observations,attendance_record_corrections,attendance_observation_revisions";
}
