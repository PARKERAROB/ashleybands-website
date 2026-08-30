import { NextResponse } from "next/server";
import {
  adjustAttendanceEventRoster,
  beginHistoricalAttendanceReconstruction,
  certifyAttendanceEventRoster,
  removeAttendanceEventStudentWithRecords,
  reopenAttendanceEvent
} from "@/lib/attendance";
import { loadProgramAttendanceWorkspace } from "@/lib/attendanceWorkspace";
import { logAudit, staffActor } from "@/lib/auditLog";
import { loadSchoolAttendanceWorkspace } from "@/lib/schoolAttendance";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";

export const runtime = "nodejs";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

function failure(error, fallback) {
  const status = Number(error?.status);
  if (status >= 400 && status < 500) return json({ error: error.message }, status);
  console.error("[admin-attendance] request failed:", error?.message || error);
  return json({ error: fallback }, 500);
}

export async function GET(request) {
  const url = new URL(request.url);
  const source = url.searchParams.get("source") === "school" ? "school" : "program";
  const capability = source === "school"
    ? STAFF_CAPABILITIES.ATTENDANCE_SCHOOL_READ
    : STAFF_CAPABILITIES.ATTENDANCE_EVENTS_READ;
  const authorization = await authorizeStaffRequest(request, capability);
  if (!authorization.ok) return json({ error: authorization.error }, authorization.status);
  try {
    const result = source === "school"
      ? await loadSchoolAttendanceWorkspace({
          studentId: url.searchParams.get("student") || ""
        })
      : await loadProgramAttendanceWorkspace({
          occurrenceKey: url.searchParams.get("occurrence") || "",
          studentId: url.searchParams.get("student") || ""
        });
    await logAudit({
      actor: staffActor(authorization.staff),
      action: `attendance.${source}.workspace.read`,
      table: source === "school"
        ? "school_attendance_imports,school_attendance_import_sections,school_attendance_import_roster,school_attendance_marks"
        : "attendance_events,attendance_event_roster,attendance_observations",
      changes: {
        source,
        student_scoped: Boolean(url.searchParams.get("student")),
        occurrence_scoped: Boolean(url.searchParams.get("occurrence"))
      },
      route: "/api/admin/attendance"
    });
    return json({ source, ...result });
  } catch (error) {
    return failure(error, "Attendance records could not be loaded.");
  }
}

export async function PATCH(request) {
  const authorization = await authorizeStaffRequest(request, STAFF_CAPABILITIES.ATTENDANCE_EVENTS_WRITE);
  if (!authorization.ok) return json({ error: authorization.error }, authorization.status);
  const body = await request.json().catch(() => ({}));
  const occurrenceKey = String(body.occurrenceKey || "").trim();
  const studentId = String(body.studentId || "").trim();
  if (body.startReconstruction) {
    if (!occurrenceKey) return json({ error: "Choose a historical event." }, 400);
    try {
      const result = await beginHistoricalAttendanceReconstruction({
        occurrenceKey,
        actorStaffId: authorization.staff.id
      });
      await logAudit({
        actor: staffActor(authorization.staff),
        action: "attendance.roster.reconstruction_started",
        table: "attendance_events,attendance_event_roster",
        changes: { occurrence_key: occurrenceKey },
        route: "/api/admin/attendance"
      });
      return json({ ok: true, ...result });
    } catch (error) {
      return failure(error, "Historical roster reconstruction could not be started.");
    }
  }
  if (body.certifyRoster) {
    if (!occurrenceKey) return json({ error: "Choose a historical event." }, 400);
    try {
      const result = await certifyAttendanceEventRoster({
        occurrenceKey,
        actorStaffId: authorization.staff.id,
        note: body.reason
      });
      await logAudit({
        actor: staffActor(authorization.staff),
        action: "attendance.roster.certified",
        table: "attendance_events,attendance_event_roster",
        changes: { occurrence_key: occurrenceKey, reason_present: true },
        route: "/api/admin/attendance"
      });
      return json({ ok: true, ...result });
    } catch (error) {
      return failure(error, "The historical roster could not be certified.");
    }
  }
  if (body.reopen) {
    if (!occurrenceKey) return json({ error: "Choose a completed event." }, 400);
    try {
      const result = await reopenAttendanceEvent({
        occurrenceKey,
        actorStaffId: authorization.staff.id,
        reason: body.reason
      });
      await logAudit({
        actor: staffActor(authorization.staff),
        action: "attendance.event.reopened",
        table: "attendance_events",
        changes: { occurrence_key: occurrenceKey, reason_present: true },
        route: "/api/admin/attendance"
      });
      return json({ ok: true, ...result });
    } catch (error) {
      return failure(error, "The completed event could not be reopened.");
    }
  }
  if (body.removeWithRecords) {
    if (!occurrenceKey || !studentId) return json({ error: "Choose an event and student." }, 400);
    try {
      const result = await removeAttendanceEventStudentWithRecords({
        occurrenceKey,
        studentId,
        actorStaffId: authorization.staff.id,
        reason: body.reason
      });
      await logAudit({
        actor: staffActor(authorization.staff),
        action: "attendance.roster.student_removed_with_records",
        table: "attendance_events,attendance_event_roster,attendance_observations,attendance_exceptions,attendance_record_corrections",
        recordId: studentId,
        changes: { occurrence_key: occurrenceKey, records_archived: true, reason_present: true },
        route: "/api/admin/attendance"
      });
      return json({ ok: true, ...result });
    } catch (error) {
      return failure(error, "The student and saved attendance records could not be corrected.");
    }
  }
  if (!occurrenceKey || !studentId || typeof body.include !== "boolean") {
    return json({ error: "Choose an event, a student, and whether to include them." }, 400);
  }
  try {
    const result = await adjustAttendanceEventRoster({
      occurrenceKey,
      studentId,
      include: body.include,
      actorStaffId: authorization.staff.id,
      reason: body.reason
    });
    await logAudit({
      actor: staffActor(authorization.staff),
      action: body.include ? "attendance.roster.student_added" : "attendance.roster.student_removed",
      table: "attendance_events,attendance_event_roster",
      recordId: studentId,
      changes: {
        occurrence_key: occurrenceKey,
        included: body.include,
        reason_present: Boolean(String(body.reason || "").trim())
      },
      route: "/api/admin/attendance"
    });
    return json({ ok: true, ...result });
  } catch (error) {
    return failure(error, "The event roster could not be adjusted.");
  }
}
