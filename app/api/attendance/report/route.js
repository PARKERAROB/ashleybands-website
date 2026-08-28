import { NextResponse } from "next/server";
import { validateAttendanceRequest } from "@/lib/attendanceAuth";
import { logAudit } from "@/lib/auditLog";
import { getAttendanceSheet, attendanceAuditTables } from "@/lib/attendance";
import { buildAttendanceReport } from "@/lib/attendanceEvents.mjs";
import { sendPortalReviewAlert } from "@/lib/portalEmail";

export const runtime = "nodejs";

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
  const session = await validateAttendanceRequest(request);
  if (!session) return NextResponse.json({ error: "Attendance PIN required." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const occurrenceKey = String(body.occurrenceKey || "").trim() || undefined;

  let sheet;
  try {
    sheet = await getAttendanceSheet({ occurrenceKey, session });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "The attendance report could not be loaded." },
      { status: error?.status || 500 }
    );
  }
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
    return NextResponse.json({ error: "There are no reportable attendance details." }, { status: 400 });
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
    return NextResponse.json(
      { error: emailError.message || "The attendance report could not be sent." },
      { status: 502 }
    );
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
  return NextResponse.json({
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
