import { NextResponse } from "next/server";
import { authorizeStaffRequest, staffHasCapability, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { loadStudent360 } from "@/lib/currentStudents";
import { logAuditRequired, staffActor } from "@/lib/auditLog";

export const runtime = "nodejs";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
const json = (body, status = 200) => NextResponse.json(body, { status, headers: PRIVATE_HEADERS });

export async function GET(request, { params }) {
  const authorization = await authorizeStaffRequest(request, STAFF_CAPABILITIES.STUDENTS_READ);
  if (!authorization.ok) {
    return json({ error: authorization.error }, authorization.status);
  }

  const { id } = await params;
  try {
    const student = await loadStudent360(String(id || ""), {
      assets: staffHasCapability(authorization.staff, STAFF_CAPABILITIES.ASSETS_READ),
      attendance: staffHasCapability(authorization.staff, STAFF_CAPABILITIES.ATTENDANCE_EVENTS_READ),
      finance: staffHasCapability(authorization.staff, STAFF_CAPABILITIES.BILLING_READ),
      forms: staffHasCapability(authorization.staff, STAFF_CAPABILITIES.FORMS_STATUS_READ),
      memberships: staffHasCapability(authorization.staff, STAFF_CAPABILITIES.MEMBERSHIPS_READ),
      communications: staffHasCapability(authorization.staff, STAFF_CAPABILITIES.COMMUNICATIONS_READ),
    });
    if (!student) return json({ error: "Student not found" }, 404);
    await logAuditRequired({
      actor: staffActor(authorization.staff),
      action: "view",
      table: "student_360",
      recordId: student.id,
      route: "/api/admin/current-students/[id]",
    });
    return json({ student });
  } catch (error) {
    console.error("[student-360] load failed:", error?.message || error);
    return json({ error: "The connected student record could not be loaded or durably attributed." }, 503);
  }
}
