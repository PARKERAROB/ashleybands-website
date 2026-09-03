import { NextResponse } from "next/server";
import { logAudit, staffActor } from "@/lib/auditLog";
import { validateAttendanceRequest } from "@/lib/attendanceAuth";
import {
  authorizeStaffRequest,
  STAFF_CAPABILITIES,
  staffHasCapability
} from "@/lib/staffAuthorization";
import { staffUsesAssignedScopes } from "@/lib/staffCapabilities";
import {
  attendanceAuditTables,
  completeAttendanceEvent,
  getAttendanceSheet,
  prepareAttendanceEvent,
  saveApprovedAttendanceException,
  updateAttendanceObservation,
  updateStaffAttendance
} from "@/lib/attendance";
import { shouldAutoPrepareAttendanceOccurrence } from "@/lib/attendanceEvents.mjs";

export const runtime = "nodejs";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

function safeFailure(error, fallback = "Attendance could not be updated.") {
  const status = Number(error?.status);
  if (status >= 400 && status < 500) return json({ error: error.message || fallback }, status);
  console.error("[attendance] request failed:", error?.message || error);
  return json({ error: fallback }, 500);
}

function sessionFor(staff) {
  return {
    actor: staffActor(staff),
    access: "staff",
    permissions: {
      eventsWrite: staffHasCapability(staff, STAFF_CAPABILITIES.ATTENDANCE_EVENTS_WRITE),
      exceptionsWrite: staffHasCapability(staff, STAFF_CAPABILITIES.ATTENDANCE_EXCEPTIONS_WRITE),
      staffWrite: staffHasCapability(staff, STAFF_CAPABILITIES.ATTENDANCE_STAFF_WRITE),
      reportSend: staffHasCapability(staff, STAFF_CAPABILITIES.ATTENDANCE_REPORT_SEND),
      prepare: staffHasCapability(staff, STAFF_CAPABILITIES.ATTENDANCE_EVENTS_WRITE),
      complete: staffHasCapability(staff, STAFF_CAPABILITIES.ATTENDANCE_EVENTS_WRITE)
    }
  };
}

function sharedPinSession(session) {
  return {
    ...session,
    permissions: {
      eventsWrite: true,
      exceptionsWrite: false,
      staffWrite: false,
      reportSend: false,
      prepare: true,
      complete: false
    }
  };
}

async function authorize(request, capability, occurrenceKey, { allowSharedPin = false } = {}) {
  const attendanceSession = await validateAttendanceRequest(request);
  if (attendanceSession?.access === "shared_pin") {
    if (!allowSharedPin) {
      return { response: json({ error: "Named staff access is required for this operation." }, 403) };
    }
    return { authorization: { staff: null }, session: sharedPinSession(attendanceSession) };
  }
  const authorization = await authorizeStaffRequest(request, capability, {
    scope: occurrenceKey
      ? { type: "attendance_event", ref: occurrenceKey }
      : { type: "global" },
  });
  if (!authorization.ok) return { response: json({ error: authorization.error }, authorization.status) };
  return { authorization, session: sessionFor(authorization.staff) };
}

export async function GET(request) {
  const occurrenceKey = new URL(request.url).searchParams.get("occurrence") || undefined;
  const access = await authorize(request, STAFF_CAPABILITIES.ATTENDANCE_EVENTS_READ, occurrenceKey, {
    allowSharedPin: true
  });
  if (access.response) return access.response;

  try {
    const now = new Date();
    let sheet = await getAttendanceSheet({ occurrenceKey, session: access.session, now });
    if (shouldAutoPrepareAttendanceOccurrence({
      access: access.session.access,
      canPrepare: sheet.canPrepare,
      event: sheet.event,
      now
    })) {
      const prepared = await prepareAttendanceEvent({
        occurrenceKey: sheet.event.occurrenceKey,
        actorStaffId: access.authorization.staff?.id || null,
        now
      });
      await logAudit({
        actor: access.session.actor,
        action: "attendance.event.prepared",
        table: "attendance_events,attendance_event_roster,attendance_event_roster_groups",
        changes: {
          occurrence_key: sheet.event.occurrenceKey,
          roster_count: prepared?.rosterCount || 0,
          preparation: "automatic_current_session"
        },
        route: "/api/attendance"
      });
      sheet = await getAttendanceSheet({
        occurrenceKey: sheet.event.occurrenceKey,
        session: access.session,
        now
      });
    }
    if (occurrenceKey && access.authorization.staff && staffUsesAssignedScopes(access.authorization.staff)) {
      sheet.occurrences = sheet.occurrences.filter((event) => event.occurrenceKey === occurrenceKey);
    }
    await logAudit({
      actor: access.session.actor,
      action: "attendance.sheet.read",
      table: attendanceAuditTables(),
      changes: {
        occurrence_key: sheet.event.occurrenceKey,
        row_count: sheet.students.length,
        staff_row_count: sheet.staff.length,
        exception_count: sheet.exceptions.length
      },
      route: "/api/attendance"
    });
    return json(sheet);
  } catch (error) {
    return safeFailure(error, "Attendance could not be loaded.");
  }
}

export async function PATCH(request) {
  const body = await request.json().catch(() => ({}));
  const occurrenceKey = String(body.occurrenceKey || "").trim() || undefined;
  const capability = body.prepare
    ? STAFF_CAPABILITIES.ATTENDANCE_EVENTS_WRITE
    : body.staffAttendance
      ? STAFF_CAPABILITIES.ATTENDANCE_STAFF_WRITE
      : body.exception
        ? STAFF_CAPABILITIES.ATTENDANCE_EXCEPTIONS_WRITE
        : STAFF_CAPABILITIES.ATTENDANCE_EVENTS_WRITE;
  const sharedPinFieldOperation = !body.complete && !body.staffAttendance && !body.exception;
  const access = await authorize(request, capability, occurrenceKey, {
    allowSharedPin: sharedPinFieldOperation
  });
  if (access.response) return access.response;

  try {
    if (body.prepare) {
      const prepared = await prepareAttendanceEvent({
        occurrenceKey,
        actorStaffId: access.authorization.staff?.id || null
      });
      await logAudit({
        actor: access.session.actor,
        action: "attendance.event.prepared",
        table: "attendance_events,attendance_event_roster,attendance_event_roster_groups",
        changes: { occurrence_key: occurrenceKey, roster_count: prepared?.rosterCount || 0 },
        route: "/api/attendance"
      });
      return json({ ok: true, ...prepared });
    }

    if (body.complete) {
      const completed = await completeAttendanceEvent({
        occurrenceKey,
        actorStaffId: access.authorization.staff.id,
        note: body.completionNote
      });
      await logAudit({
        actor: access.session.actor,
        action: "attendance.event.completed",
        table: "attendance_events,attendance_event_roster,attendance_observations",
        changes: { occurrence_key: occurrenceKey, completed: true },
        route: "/api/attendance"
      });
      return json({ ok: true, ...completed });
    }

    if (body.staffAttendance) {
      const staffAttendance = body.staffAttendance || {};
      const allowedKeys = ["status", "arrivedTime", "departedTime", "roleAssignment", "workNotes"];
      const changes = Object.fromEntries(
        allowedKeys
          .filter((key) => Object.prototype.hasOwnProperty.call(staffAttendance, key))
          .map((key) => [key, staffAttendance[key]])
      );
      const result = await updateStaffAttendance({
        occurrenceKey,
        recordId: String(staffAttendance.recordId || "").trim() || undefined,
        staffId: String(staffAttendance.staffId || "").trim() || undefined,
        displayName: staffAttendance.displayName,
        changes
      });
      await logAudit({
        actor: access.session.actor,
        action: "attendance.staff.updated",
        table: "attendance_staff_observations,staff,attendance_events",
        recordId: result.staffAttendance.id || result.staffAttendance.staffId,
        changes: {
          occurrence_key: result.event.occurrenceKey,
          staff_id: result.staffAttendance.staffId,
          status: result.staffAttendance.status,
          arrival_recorded: Boolean(result.staffAttendance.arrivedAt),
          departure_recorded: Boolean(result.staffAttendance.departedAt),
          role_assignment_present: Boolean(result.staffAttendance.roleAssignment),
          work_notes_present: Boolean(result.staffAttendance.workNotes)
        },
        route: "/api/attendance"
      });
      return json(result.staffAttendance);
    }

    const studentId = String(body.studentId || "").trim();
    if (!studentId) return json({ error: "Choose a student." }, 400);
    if (body.exception) {
      const result = await saveApprovedAttendanceException({
        occurrenceKey,
        studentId,
        kind: String(body.exception.kind || "").trim(),
        expectedTime: body.exception.expectedTime,
        note: body.exception.note,
        session: access.session
      });
      await logAudit({
        actor: access.session.actor,
        action: "attendance.exception.approved",
        table: "attendance_exceptions,portal_students,attendance_events",
        recordId: result.exception.id,
        changes: {
          occurrence_key: result.event.occurrenceKey,
          portal_student_id: result.student.id,
          kind: result.exception.kind,
          expected_at: result.exception.expected_at
        },
        route: "/api/attendance"
      });
      return json(result.exception);
    }

    const allowedKeys = ["status", "note", "arrivedTime", "departedTime"];
    const changes = Object.fromEntries(
      allowedKeys
        .filter((key) => Object.prototype.hasOwnProperty.call(body, key))
        .map((key) => [key, body[key]])
    );
    if (!Object.keys(changes).length) return json({ error: "No attendance change was provided." }, 400);
    const result = await updateAttendanceObservation({
      occurrenceKey,
      studentId,
      changes,
      actorStaffId: access.authorization.staff?.id || null
    });
    await logAudit({
      actor: access.session.actor,
      action: "attendance.observation.updated",
      table: "attendance_observations,portal_students,attendance_events",
      recordId: result.student.id,
      changes: {
        occurrence_key: result.event.occurrenceKey,
        status: result.observation.status,
        note_present: Boolean(result.observation.note),
        arrived_at: result.observation.arrived_at,
        departed_at: result.observation.departed_at
      },
      route: "/api/attendance"
    });
    return json({
      studentId: result.student.id,
      status: result.observation.status,
      note: result.observation.note || "",
      arrivedAt: result.observation.arrived_at,
      departedAt: result.observation.departed_at
    });
  } catch (error) {
    return safeFailure(error);
  }
}
