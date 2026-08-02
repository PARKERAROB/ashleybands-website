import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateAttendanceRequest } from "@/lib/attendanceAuth";
import { logAudit } from "@/lib/auditLog";
import { attendanceSectionForStudent, compareMarchingSections } from "@/lib/marchingBandOrder";

export const runtime = "nodejs";

const ATTENDANCE_DATE = "2026-08-03";
const VALID_STATUSES = new Set(["present", "tardy", "absent"]);

function displayGrade(value) {
  const grade = String(value || "").trim();
  const described = grade.match(/(?:rising|incoming)\s+(\d{1,2})(?:st|nd|rd|th)?/i);
  if (described) return described[1];
  const numeric = grade.match(/^0?(\d{1,2})$/);
  return numeric ? numeric[1] : (grade || "—");
}

function unauthorized() {
  return NextResponse.json({ error: "Attendance PIN required." }, { status: 401 });
}

export async function GET(request) {
  const session = await validateAttendanceRequest(request);
  if (!session) return unauthorized();

  const [confirmedResult, provisionalResult, marksResult] = await Promise.all([
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
      .or("notes.ilike.%provisional%,notes.ilike.%pending and not counted%"),
    supabaseAdmin
      .from("band_camp_attendance_2026")
      .select("portal_student_id, status, note, updated_at")
      .eq("attendance_date", ATTENDANCE_DATE)
  ]);

  if (confirmedResult.error || provisionalResult.error || marksResult.error) {
    const message = confirmedResult.error?.message
      || provisionalResult.error?.message
      || marksResult.error?.message
      || "Attendance could not be loaded.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const marks = new Map((marksResult.data || []).map((row) => [row.portal_student_id, row]));
  const rosterById = new Map();
  for (const student of confirmedResult.data || []) rosterById.set(student.id, student);
  for (const student of provisionalResult.data || []) rosterById.set(student.id, student);

  const students = Array.from(rosterById.values())
    .map((student) => ({
      id: student.id,
      name: student.display_name,
      lastName: student.legal_last || student.display_name,
      grade: displayGrade(student.grade_fall26),
      section: attendanceSectionForStudent({
        role: student.mb_role_2026,
        instrument: student.instrument_2026
      }),
      assignment: student.mb_role_2026 ? null : (student.instrument_2026 || "Placement pending"),
      provisional: !student.mb_role_2026,
      status: marks.get(student.id)?.status || null,
      note: marks.get(student.id)?.note || "",
      updatedAt: marks.get(student.id)?.updated_at || null
    }))
    .sort((a, b) => compareMarchingSections(a.section, b.section)
      || a.lastName.localeCompare(b.lastName));

  await logAudit({
    actor: session.actor,
    action: "attendance.roster.read",
    table: "portal_students,band_camp_attendance_2026",
    changes: { attendance_date: ATTENDANCE_DATE, row_count: students.length },
    route: "/api/attendance"
  });

  return NextResponse.json({
    date: ATTENDANCE_DATE,
    eventName: "Band Camp Day 1",
    students
  });
}

export async function PATCH(request) {
  const session = await validateAttendanceRequest(request);
  if (!session) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const studentId = String(body.studentId || "").trim();
  const status = String(body.status || "").trim().toLowerCase();
  const hasNote = Object.prototype.hasOwnProperty.call(body, "note");
  const clearing = status === "unmarked";
  if (!studentId || (!hasNote && !VALID_STATUSES.has(status) && !clearing)) {
    return NextResponse.json({ error: "Choose Present, Tardy, Absent, or Unmarked." }, { status: 400 });
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("portal_students")
    .select("id, display_name, mb_role_2026, notes, status")
    .eq("id", studentId)
    .maybeSingle();
  const provisional = /provisional|pending and not counted/i.test(student?.notes || "");
  if (studentError || !student || student.status !== "active" || (!student.mb_role_2026 && !provisional)) {
    return NextResponse.json({ error: "Student is not on the active marching-band roster." }, { status: 404 });
  }

  if (hasNote) {
    const note = String(body.note || "").trim().slice(0, 1000);
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("band_camp_attendance_2026")
      .select("status")
      .eq("attendance_date", ATTENDANCE_DATE)
      .eq("portal_student_id", student.id)
      .maybeSingle();
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

    if (!note && !existing?.status) {
      const { error } = await supabaseAdmin
        .from("band_camp_attendance_2026")
        .delete()
        .eq("attendance_date", ATTENDANCE_DATE)
        .eq("portal_student_id", student.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await supabaseAdmin
        .from("band_camp_attendance_2026")
        .upsert({
          attendance_date: ATTENDANCE_DATE,
          portal_student_id: student.id,
          status: existing?.status || null,
          note: note || null,
          source: "attendance_web",
          updated_at: new Date().toISOString()
        }, { onConflict: "attendance_date,portal_student_id" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logAudit({
      actor: session.actor,
      action: note ? "attendance.note.updated" : "attendance.note.cleared",
      table: "band_camp_attendance_2026",
      recordId: student.id,
      changes: { attendance_date: ATTENDANCE_DATE, note_present: Boolean(note) },
      route: "/api/attendance"
    });

    return NextResponse.json({ studentId: student.id, note });
  }

  if (clearing) {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("band_camp_attendance_2026")
      .select("note")
      .eq("attendance_date", ATTENDANCE_DATE)
      .eq("portal_student_id", student.id)
      .maybeSingle();
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

    const query = existing?.note
      ? supabaseAdmin
        .from("band_camp_attendance_2026")
        .update({ status: null, updated_at: new Date().toISOString() })
        .eq("attendance_date", ATTENDANCE_DATE)
        .eq("portal_student_id", student.id)
      : supabaseAdmin
      .from("band_camp_attendance_2026")
      .delete()
      .eq("attendance_date", ATTENDANCE_DATE)
      .eq("portal_student_id", student.id);
    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logAudit({
      actor: session.actor,
      action: "attendance.mark.cleared",
      table: "band_camp_attendance_2026",
      recordId: student.id,
      changes: { attendance_date: ATTENDANCE_DATE, status: null },
      route: "/api/attendance"
    });

    return NextResponse.json({ studentId: student.id, status: null, updatedAt: null });
  }

  const { data, error } = await supabaseAdmin
    .from("band_camp_attendance_2026")
    .upsert({
      attendance_date: ATTENDANCE_DATE,
      portal_student_id: student.id,
      status,
      source: "attendance_web",
      updated_at: new Date().toISOString()
    }, { onConflict: "attendance_date,portal_student_id" })
    .select("status, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actor: session.actor,
    action: "attendance.mark.updated",
    table: "band_camp_attendance_2026",
    recordId: student.id,
    changes: { attendance_date: ATTENDANCE_DATE, status },
    route: "/api/attendance"
  });

  return NextResponse.json({ studentId: student.id, ...data });
}
