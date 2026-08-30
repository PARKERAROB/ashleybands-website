import { NextResponse } from "next/server";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { loadStudent360 } from "@/lib/currentStudents";
import { logAudit, staffActor } from "@/lib/auditLog";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  const authorization = await authorizeStaffRequest(request, STAFF_CAPABILITIES.STUDENTS_READ);
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  const { id } = await params;
  try {
    const student = await loadStudent360(String(id || ""));
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
    await logAudit({
      actor: staffActor(authorization.staff),
      action: "view",
      table: "student_360",
      recordId: student.id,
      route: "/api/admin/current-students/[id]",
    });
    return NextResponse.json({ student });
  } catch (error) {
    console.error("[student-360] load failed:", error?.message || error);
    return NextResponse.json({ error: "The connected student record could not be loaded." }, { status: 500 });
  }
}
