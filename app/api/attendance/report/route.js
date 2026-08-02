import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateAttendanceRequest } from "@/lib/attendanceAuth";
import { logAudit } from "@/lib/auditLog";
import { sendPortalReviewAlert } from "@/lib/portalEmail";

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
    .select("portal_student_id, portal_students(display_name, grade_fall26, mb_role_2026)")
    .eq("attendance_date", ATTENDANCE_DATE)
    .eq("status", "absent");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const absent = (data || [])
    .map((row) => row.portal_students)
    .filter(Boolean)
    .sort((a, b) => String(a.mb_role_2026).localeCompare(String(b.mb_role_2026))
      || String(a.display_name).localeCompare(String(b.display_name)));

  await logAudit({
    actor: session.actor,
    action: "attendance.absent_report.read",
    table: "band_camp_attendance_2026,portal_students",
    changes: { attendance_date: ATTENDANCE_DATE, absent_count: absent.length },
    route: "/api/attendance/report"
  });

  if (!absent.length) {
    return NextResponse.json({ error: "No students are currently marked absent." }, { status: 400 });
  }

  const details = absent.map((student) =>
    `${student.display_name} — ${student.mb_role_2026 || "Provisional / placement pending"}, Grade ${displayGrade(student.grade_fall26)}`
  );

  try {
    await sendPortalReviewAlert({
      subject: `Band Camp Day 1 — ${absent.length} marked absent`,
      summary: `${absent.length} student${absent.length === 1 ? " is" : "s are"} marked absent for Monday, August 3, 2026.`,
      details
    });
  } catch (emailError) {
    return NextResponse.json({ error: emailError.message || "The absent list could not be sent." }, { status: 502 });
  }

  await logAudit({
    actor: session.actor,
    action: "attendance.absent_report.sent",
    table: "band_camp_attendance_2026,portal_students",
    changes: { attendance_date: ATTENDANCE_DATE, absent_count: absent.length },
    route: "/api/attendance/report"
  });

  return NextResponse.json({ ok: true, count: absent.length });
}
