import { NextResponse } from "next/server";
import { validateAttendanceRequest } from "@/lib/attendanceAuth";
import { logAudit } from "@/lib/auditLog";
import {
  attendanceAuditTables,
  getAttendanceSheet,
  saveApprovedAttendanceException,
  updateAttendanceObservation
} from "@/lib/attendance";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Attendance PIN required." }, { status: 401 });
}

function failure(error, fallback = "Attendance could not be updated.") {
  return NextResponse.json(
    { error: error?.message || fallback },
    { status: error?.status || 500 }
  );
}

export async function GET(request) {
  const session = await validateAttendanceRequest(request);
  if (!session) return unauthorized();
  const occurrenceKey = new URL(request.url).searchParams.get("occurrence") || undefined;

  try {
    const sheet = await getAttendanceSheet({ occurrenceKey, session });
    await logAudit({
      actor: session.actor,
      action: "attendance.sheet.read",
      table: attendanceAuditTables(),
      changes: {
        occurrence_key: sheet.event.occurrenceKey,
        row_count: sheet.students.length,
        exception_count: sheet.exceptions.length
      },
      route: "/api/attendance"
    });
    return NextResponse.json(sheet);
  } catch (error) {
    return failure(error, "Attendance could not be loaded.");
  }
}

export async function PATCH(request) {
  const session = await validateAttendanceRequest(request);
  if (!session) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const occurrenceKey = String(body.occurrenceKey || "").trim() || undefined;
  const studentId = String(body.studentId || "").trim();
  if (!studentId) {
    return NextResponse.json({ error: "Choose a student." }, { status: 400 });
  }

  try {
    if (body.exception) {
      const result = await saveApprovedAttendanceException({
        occurrenceKey,
        studentId,
        kind: String(body.exception.kind || "").trim(),
        expectedTime: body.exception.expectedTime,
        note: body.exception.note,
        session
      });
      await logAudit({
        actor: session.actor,
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
      return NextResponse.json(result.exception);
    }

    const allowedKeys = ["status", "note", "arrivedTime", "departedTime"];
    const changes = Object.fromEntries(
      allowedKeys
        .filter((key) => Object.prototype.hasOwnProperty.call(body, key))
        .map((key) => [key, body[key]])
    );
    if (!Object.keys(changes).length) {
      return NextResponse.json({ error: "No attendance change was provided." }, { status: 400 });
    }
    const result = await updateAttendanceObservation({
      occurrenceKey,
      studentId,
      changes
    });
    await logAudit({
      actor: session.actor,
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
    return NextResponse.json({
      studentId: result.student.id,
      status: result.observation.status,
      note: result.observation.note || "",
      arrivedAt: result.observation.arrived_at,
      departedAt: result.observation.departed_at
    });
  } catch (error) {
    return failure(error);
  }
}
