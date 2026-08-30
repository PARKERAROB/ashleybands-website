import { NextResponse } from "next/server";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { loadCurrentStudents } from "@/lib/currentStudents";
import { logAudit, staffActor } from "@/lib/auditLog";

export const runtime = "nodejs";

export async function GET(request) {
  const authorization = await authorizeStaffRequest(request, STAFF_CAPABILITIES.STUDENTS_READ);
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  const requestedView = new URL(request.url).searchParams.get("view");
  const view = requestedView === "inactive" ? "inactive" : "active";

  try {
    const result = await loadCurrentStudents(view);
    await logAudit({
      actor: staffActor(authorization.staff),
      action: "view",
      table: "portal_students,portal_student_people,portal_contact_methods,portal_instrument_requests",
      recordId: view,
      route: "/api/admin/current-students",
    });
    return NextResponse.json({ ...result, view });
  } catch (error) {
    console.error("[current-students] load failed:", error?.message || error);
    return NextResponse.json({ error: "Current student records could not be loaded." }, { status: 500 });
  }
}
