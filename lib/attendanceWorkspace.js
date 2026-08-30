import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { listAttendanceEventRows } from "@/lib/attendance";
import { ATTENDANCE_TIME_ZONE, localDateAt } from "@/lib/attendanceEvents.mjs";

function displayGrade(value) {
  const match = String(value || "").match(/(?:rising|incoming)?\s*0?(\d{1,2})/i);
  return match ? match[1] : String(value || "").trim() || "Not listed";
}

function publicStudent(student) {
  return student ? {
    id: student.id,
    displayName: student.display_name,
    grade: displayGrade(student.grade_fall26),
    instrument: String(student.instrument_2026 || student.mb_role_2026 || "Not listed"),
    status: String(student.status || "inactive").toLowerCase()
  } : null;
}

export async function loadProgramAttendanceWorkspace({ occurrenceKey = "", studentId = "" } = {}) {
  const today = localDateAt(new Date(), ATTENDANCE_TIME_ZONE);
  const events = await listAttendanceEventRows();
  const eventIds = events.map((event) => event.id).filter(Boolean);
  if (!events.length) return { events: [], concerns: [], selected: null, student: null };

  const [rosterResult, observationResult, exceptionResult, mappingResult] = await Promise.all([
    eventIds.length ? supabaseAdmin
      .from("attendance_event_roster")
      .select("attendance_event_id,student_id,reconstruction_quality,role_snapshot,portal_students!inner(id,display_name,grade_fall26,instrument_2026,mb_role_2026,status)")
      .in("attendance_event_id", eventIds)
      .eq("roster_state", "included") : Promise.resolve({ data: [], error: null }),
    eventIds.length ? supabaseAdmin
      .from("attendance_observations")
      .select("attendance_event_id,portal_student_id,status,note,arrived_at,departed_at,updated_at")
      .in("attendance_event_id", eventIds) : Promise.resolve({ data: [], error: null }),
    eventIds.length ? supabaseAdmin
      .from("attendance_exceptions")
      .select("attendance_event_id,portal_student_id,id")
      .in("attendance_event_id", eventIds) : Promise.resolve({ data: [], error: null }),
    supabaseAdmin
      .from("attendance_calendar_groups")
      .select("calendar_event_id,program_groups!inner(name)")
      .in("calendar_event_id", [...new Set(events.map((event) => event.calendar_event_id))])
  ]);
  if (rosterResult.error || observationResult.error || exceptionResult.error || mappingResult.error) {
    throw rosterResult.error || observationResult.error || exceptionResult.error || mappingResult.error;
  }

  const rosterByEvent = new Map();
  const observationByEvent = new Map();
  const groupNamesByCalendar = new Map();
  for (const row of rosterResult.data || []) {
    const current = rosterByEvent.get(row.attendance_event_id) || [];
    current.push(row);
    rosterByEvent.set(row.attendance_event_id, current);
  }
  for (const row of observationResult.data || []) {
    const current = observationByEvent.get(row.attendance_event_id) || [];
    current.push(row);
    observationByEvent.set(row.attendance_event_id, current);
  }
  for (const row of mappingResult.data || []) {
    const current = groupNamesByCalendar.get(row.calendar_event_id) || [];
    if (row.program_groups?.name) current.push(row.program_groups.name);
    groupNamesByCalendar.set(row.calendar_event_id, current);
  }

  const summaries = events.map((event) => {
    const roster = rosterByEvent.get(event.id) || [];
    const observations = observationByEvent.get(event.id) || [];
    const completeness = !roster.length
      ? "missing"
      : event.roster_certification_state === "certified"
        ? "locked"
        : event.roster_certification_state === "reconstructing"
          ? "reconstructing"
          : event.roster_locked_at
            ? "observed_only"
            : "preview";
    const statusRows = observations.filter((row) => row.status);
    const localDate = localDateAt(new Date(event.starts_at), ATTENDANCE_TIME_ZONE);
    const unmarkedCount = ["locked", "preview"].includes(completeness)
      ? Math.max(0, roster.length - statusRows.length)
      : null;
    return {
      id: event.id || event.occurrence_key,
      occurrenceKey: event.occurrence_key,
      calendarEventId: event.calendar_event_id,
      title: event.title,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      localDate,
      isPast: localDate < today,
      isFuture: localDate > today,
      lifecycleState: event.lifecycle_state,
      rosterLocked: Boolean(event.roster_locked_at),
      rosterCertificationState: event.roster_certification_state || "unlocked",
      rosterCertificationNote: event.roster_certification_note || "",
      rosterCompleteness: completeness,
      groups: [...new Set(groupNamesByCalendar.get(event.calendar_event_id) || [])].sort(),
      expectedCount: ["locked", "preview"].includes(completeness) ? roster.length : null,
      savedRecordCount: roster.length,
      presentCount: statusRows.filter((row) => row.status === "present").length,
      tardyCount: statusRows.filter((row) => row.status === "tardy").length,
      absentCount: statusRows.filter((row) => row.status === "absent").length,
      unmarkedCount,
      needsAction: localDate <= today
        && event.lifecycle_state !== "completed"
        && (completeness === "missing" || completeness === "reconstructing" || unmarkedCount > 0),
      completedAt: event.completed_at,
      completionNote: event.completion_note || ""
    };
  }).sort((a, b) => {
    const aCurrent = a.localDate >= today ? 0 : 1;
    const bCurrent = b.localDate >= today ? 0 : 1;
    if (aCurrent !== bCurrent) return aCurrent - bCurrent;
    return aCurrent === 0
      ? a.startsAt.localeCompare(b.startsAt)
      : b.startsAt.localeCompare(a.startsAt);
  });

  const completedIds = new Set(summaries
    .filter((event) => event.lifecycleState === "completed" && event.rosterCompleteness === "locked")
    .map((event) => event.id));
  const concernsByStudent = new Map();
  for (const observation of observationResult.data || []) {
    if (!completedIds.has(observation.attendance_event_id)
      || !["absent", "tardy"].includes(observation.status)) continue;
    const roster = (rosterByEvent.get(observation.attendance_event_id) || [])
      .find((row) => row.student_id === observation.portal_student_id);
    if (!roster) continue;
    const current = concernsByStudent.get(observation.portal_student_id) || {
      student: publicStudent(roster.portal_students),
      absentCount: 0,
      tardyCount: 0
    };
    current[`${observation.status}Count`] += 1;
    concernsByStudent.set(observation.portal_student_id, current);
  }
  const concerns = [...concernsByStudent.values()]
    .sort((a, b) => b.absentCount - a.absentCount
      || b.tardyCount - a.tardyCount
      || a.student.displayName.localeCompare(b.student.displayName));

  const selectedSummary = occurrenceKey
    ? summaries.find((event) => event.occurrenceKey === occurrenceKey)
    : null;
  let selected = null;
  if (selectedSummary) {
    const roster = rosterByEvent.get(selectedSummary.id) || [];
    const observations = new Map(
      (observationByEvent.get(selectedSummary.id) || []).map((row) => [row.portal_student_id, row])
    );
    const exceptionStudentIds = new Set((exceptionResult.data || [])
      .filter((row) => row.attendance_event_id === selectedSummary.id)
      .map((row) => row.portal_student_id));
    const rosterIds = new Set(roster.map((row) => row.student_id));
    const { data: candidates, error: candidateError } = await supabaseAdmin
      .from("portal_students")
      .select("id,display_name,grade_fall26,instrument_2026,mb_role_2026,status")
      .order("legal_last", { ascending: true })
      .order("legal_first", { ascending: true })
      .limit(500);
    if (candidateError) throw candidateError;
    selected = {
      ...selectedSummary,
      students: roster.map((row) => ({
        ...publicStudent(row.portal_students),
        rosterQuality: row.reconstruction_quality,
        role: row.role_snapshot || row.portal_students?.instrument_2026 || "Not listed",
        status: observations.get(row.student_id)?.status || null,
        note: observations.get(row.student_id)?.note || "",
        hasSavedRecords: observations.has(row.student_id) || exceptionStudentIds.has(row.student_id)
      })).sort((a, b) => a.displayName.localeCompare(b.displayName)),
      candidates: (candidates || [])
        .filter((student) => !rosterIds.has(student.id))
        .filter((student) => selectedSummary.isPast
          || ["observed_only", "reconstructing"].includes(selectedSummary.rosterCompleteness)
          || String(student.status || "").toLowerCase() === "active")
        .map(publicStudent)
    };
  }

  let student = null;
  if (studentId) {
    const rosterRows = (rosterResult.data || []).filter((row) => row.student_id === studentId);
    let studentRecord = rosterRows[0]?.portal_students || null;
    if (!studentRecord) {
      const { data: independentStudent, error: studentError } = await supabaseAdmin
        .from("portal_students")
        .select("id,display_name,grade_fall26,instrument_2026,mb_role_2026,status")
        .eq("id", studentId)
        .maybeSingle();
      if (studentError) throw studentError;
      studentRecord = independentStudent;
    }
    if (studentRecord) {
      student = {
        ...publicStudent(studentRecord),
        events: rosterRows.map((row) => {
          const event = summaries.find((item) => item.id === row.attendance_event_id);
          const observation = (observationByEvent.get(row.attendance_event_id) || [])
            .find((item) => item.portal_student_id === studentId);
          return event ? {
            occurrenceKey: event.occurrenceKey,
            title: event.title,
            localDate: event.localDate,
            groups: event.groups,
            rosterCompleteness: event.rosterCompleteness,
            lifecycleState: event.lifecycleState,
            status: observation?.status || null,
            note: observation?.note || ""
          } : null;
        }).filter(Boolean).sort((a, b) => b.localDate.localeCompare(a.localDate))
      };
    }
  }
  return { events: summaries, concerns, selected, student };
}
