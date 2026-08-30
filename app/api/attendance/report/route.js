import { NextResponse } from "next/server";
import {
  authorizeStaffRequest,
  STAFF_CAPABILITIES,
  staffHasCapability
} from "@/lib/staffAuthorization";
import { logAudit } from "@/lib/auditLog";
import { getAttendanceSheet, attendanceAuditTables } from "@/lib/attendance";
import { buildAttendanceReport } from "@/lib/attendanceEvents.mjs";
import { sendPortalReviewAlert } from "@/lib/portalEmail";

export const runtime = "nodejs";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

function eventDateLabel(event) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: event.timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date(event.startsAt));
}

export async function POST(request) {
  const authorization = await authorizeStaffRequest(request, STAFF_CAPABILITIES.ATTENDANCE_REPORT_SEND);
  if (!authorization.ok) {
    return json({ error: authorization.error }, authorization.status);
  }
  const session = {
    actor: {
      type: "staff",
      id: authorization.staff.id,
      name: authorization.staff.display_name
    },
    access: "staff",
    permissions: {
      eventsWrite: staffHasCapability(authorization.staff, STAFF_CAPABILITIES.ATTENDANCE_EVENTS_WRITE),
      exceptionsWrite: staffHasCapability(authorization.staff, STAFF_CAPABILITIES.ATTENDANCE_EXCEPTIONS_WRITE),
      staffWrite: staffHasCapability(authorization.staff, STAFF_CAPABILITIES.ATTENDANCE_STAFF_WRITE),
      reportSend: true
    }
  };
  const body = await request.json().catch(() => ({}));
  const occurrenceKey = String(body.occurrenceKey || "").trim() || undefined;

  let sheet;
  try {
    sheet = await getAttendanceSheet({ occurrenceKey, session });
  } catch (error) {
    const status = Number(error?.status);
    if (status >= 400 && status < 500) return json({ error: error.message }, status);
    console.error("[attendance-report] load failed:", error?.message || error);
    return json({ error: "The attendance report could not be loaded." }, 500);
  }
  if (!sheet.canSendReport) return json({ error: "This attendance session is not ready to report." }, 409);
  const report = buildAttendanceReport(sheet);
  await logAudit({
    actor: session.actor,
    action: "attendance.report.read",
    table: attendanceAuditTables(),
    changes: {
      occurrence_key: sheet.event.occurrenceKey,
      absent_count: report.absentCount,
      tardy_count: report.tardyCount,
      note_count: report.noteCount,
      departed_count: report.departedCount,
      exception_count: report.exceptionCount,
      staff_count: report.staffCount
    },
    route: "/api/attendance/report"
  });

  if (!report.details.length) {
    return json({ error: "There are no reportable attendance details." }, 400);
  }

  const dateLabel = eventDateLabel(sheet.event);
  try {
    await sendPortalReviewAlert({
      subject: `${sheet.event.title}, ${dateLabel}: attendance report`,
      summary: [
        `${sheet.event.title} on ${dateLabel}.`,
        `${report.absentCount} absent, ${report.tardyCount} tardy, ${report.noteCount} student notes,`,
        `${report.departedCount} actual student departures, ${report.exceptionCount} approved exceptions,`,
        `and ${report.staffCount} staff attendance entries.`
      ].join(" "),
      details: report.details
    });
  } catch (emailError) {
    console.error("[attendance-report] delivery failed:", emailError?.message || emailError);
    return json({ error: "The attendance report could not be sent." }, 502);
  }

  await logAudit({
    actor: session.actor,
    action: "attendance.report.sent",
    table: attendanceAuditTables(),
    changes: {
      occurrence_key: sheet.event.occurrenceKey,
      absent_count: report.absentCount,
      tardy_count: report.tardyCount,
      note_count: report.noteCount,
      departed_count: report.departedCount,
      exception_count: report.exceptionCount,
      staff_count: report.staffCount
    },
    route: "/api/attendance/report"
  });
  return json({
    ok: true,
    absentCount: report.absentCount,
    tardyCount: report.tardyCount,
    noteCount: report.noteCount,
    departedCount: report.departedCount,
    exceptionCount: report.exceptionCount,
    staffCount: report.staffCount,
    event: sheet.event
  });
}
