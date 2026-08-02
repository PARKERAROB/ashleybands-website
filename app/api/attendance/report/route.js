import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateAttendanceRequest } from "@/lib/attendanceAuth";
import { logAudit } from "@/lib/auditLog";
import { sendPortalReviewAlert } from "@/lib/portalEmail";
import { attendanceSectionForStudent, compareMarchingSections } from "@/lib/marchingBandOrder";

export const runtime = "nodejs";

const ATTENDANCE_DATE = "2026-08-03";

function displayGrade(value) {
  const grade = String(value || "").trim();
  const described = grade.match(/(?:rising|incoming)\s+(\d{1,2})(?:st|nd|rd|th)?/i);
  if (described) return described[1];
  const numeric = grade.match(/^0?(\d{1,2})$/);
  return numeric ? numeric[1] : (grade || "—");
}

export async function POST(request) {
  const session = await validateAttendanceRequest(request);
  if (!session) return NextResponse.json({ error: "Attendance PIN required." }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("band_camp_attendance_2026")
    .select("portal_student_id, status, note, portal_students(display_name, grade_fall26, mb_role_2026, instrument_2026)")
    .eq("attendance_date", ATTENDANCE_DATE)
    .or("status.eq.absent,note.not.is.null");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const reportRows = (data || [])
    .filter((row) => row.portal_students && (row.status === "absent" || String(row.note || "").trim()))
    .sort((a, b) => compareMarchingSections(
      attendanceSectionForStudent({ role: a.portal_students.mb_role_2026, instrument: a.portal_students.instrument_2026 }),
      attendanceSectionForStudent({ role: b.portal_students.mb_role_2026, instrument: b.portal_students.instrument_2026 })
    )
      || String(a.portal_students.display_name).localeCompare(String(b.portal_students.display_name)));
  const absentCount = reportRows.filter((row) => row.status === "absent").length;
  const noteCount = reportRows.filter((row) => String(row.note || "").trim()).length;

  await logAudit({
    actor: session.actor,
    action: "attendance.absent_report.read",
    table: "band_camp_attendance_2026,portal_students",
    changes: { attendance_date: ATTENDANCE_DATE, absent_count: absentCount, note_count: noteCount },
    route: "/api/attendance/report"
  });

  if (!reportRows.length) {
    return NextResponse.json({ error: "There are no marked absences or staff notes to send." }, { status: 400 });
  }

  const details = reportRows.flatMap((row) => {
    const student = row.portal_students;
    const section = attendanceSectionForStudent({
      role: student.mb_role_2026,
      instrument: student.instrument_2026
    });
    const lines = [];
    if (row.status === "absent") {
      lines.push(`ABSENT — ${student.display_name} — ${section}, Grade ${displayGrade(student.grade_fall26)}`);
    }
    if (String(row.note || "").trim()) lines.push(`NOTE — ${student.display_name}: ${String(row.note).trim()}`);
    return lines;
  });

  try {
    await sendPortalReviewAlert({
      subject: `Band Camp Day 1 — ${absentCount} absent, ${noteCount} staff note${noteCount === 1 ? "" : "s"}`,
      summary: `Attendance report for Monday, August 3, 2026: ${absentCount} marked absent and ${noteCount} staff note${noteCount === 1 ? "" : "s"}.`,
      details
    });
  } catch (emailError) {
    return NextResponse.json({ error: emailError.message || "The absent list could not be sent." }, { status: 502 });
  }

  await logAudit({
    actor: session.actor,
    action: "attendance.absent_report.sent",
    table: "band_camp_attendance_2026,portal_students",
    changes: { attendance_date: ATTENDANCE_DATE, absent_count: absentCount, note_count: noteCount },
    route: "/api/attendance/report"
  });

  return NextResponse.json({ ok: true, absentCount, noteCount });
}
