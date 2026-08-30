import { NextResponse } from "next/server";
import { logAudit, staffActor } from "@/lib/auditLog";
import {
  acceptSchoolAttendanceImport,
  buildSchoolAttendancePreview
} from "@/lib/schoolAttendance";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";

export const runtime = "nodejs";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

export async function POST(request) {
  const authorization = await authorizeStaffRequest(request, STAFF_CAPABILITIES.ATTENDANCE_SCHOOL_IMPORT);
  if (!authorization.ok) return json({ error: authorization.error }, authorization.status);

  try {
    const form = await request.formData();
    const file = form.get("file");
    const mode = String(form.get("mode") || "preview");
    if (!file || typeof file.arrayBuffer !== "function") return json({ error: "Choose an Infinite Campus Attendance Register PDF." }, 400);
    if (file.type && file.type !== "application/pdf") return json({ error: "Choose a PDF file." }, 400);
    const bytes = Buffer.from(await file.arrayBuffer());

    if (mode === "preview") {
      const preview = await buildSchoolAttendancePreview(bytes);
      await logAudit({
        actor: staffActor(authorization.staff),
        action: "attendance.school_import.previewed",
        table: "portal_students,portal_student_external_identifiers,school_attendance_imports",
        changes: {
          already_accepted: Boolean(preview.alreadyAccepted),
          roster_rows: preview.metadata?.rosterRowCount || 0,
          mark_count: preview.metadata?.markCount || 0,
          unresolved_count: preview.counts?.unresolved || 0
        },
        route: "/api/admin/attendance/school-import"
      });
      return json(preview);
    }
    if (mode !== "commit") return json({ error: "Choose preview or commit." }, 400);
    let manualMappings = {};
    try {
      manualMappings = JSON.parse(String(form.get("manualMappings") || "{}"));
    } catch {
      return json({ error: "Student matches could not be read." }, 400);
    }
    const result = await acceptSchoolAttendanceImport(bytes, {
      actorStaffId: authorization.staff.id,
      acceptSuggestions: String(form.get("acceptSuggestions") || "") === "true",
      completeSections: String(form.get("completeSections") || "") === "true",
      manualMappings
    });
    await logAudit({
      actor: staffActor(authorization.staff),
      action: "attendance.school_import.accepted",
      table: "school_attendance_imports,school_attendance_import_sections,school_attendance_import_roster,school_attendance_marks,portal_student_external_identifiers,school_class_sections,student_class_enrollments",
      recordId: result.importId,
      changes: {
        already_accepted: Boolean(result.alreadyAccepted),
        section_count: result.sectionCount || 0,
        roster_rows: result.rosterRowCount || 0,
        mark_count: result.markCount || 0
      },
      route: "/api/admin/attendance/school-import"
    });
    return json({ ok: true, ...result });
  } catch (error) {
    const status = Number(error?.status);
    if (status >= 400 && status < 500) {
      return json({ error: error.message, details: error.details || undefined }, status);
    }
    console.error("[school-attendance-import] failed:", error?.message || error);
    return json({ error: "The attendance register could not be processed." }, 500);
  }
}
