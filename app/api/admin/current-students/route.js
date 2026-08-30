import { NextResponse } from "next/server";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { loadCurrentStudents } from "@/lib/currentStudents";
import { logAuditRequired, staffActor } from "@/lib/auditLog";

export const runtime = "nodejs";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
const json = (body, status = 200) => NextResponse.json(body, { status, headers: PRIVATE_HEADERS });

export async function GET(request) {
  const authorization = await authorizeStaffRequest(request, STAFF_CAPABILITIES.STUDENTS_READ);
  if (!authorization.ok) {
    return json({ error: authorization.error }, authorization.status);
  }

  const requestedView = new URL(request.url).searchParams.get("view");
  const view = requestedView === "inactive" ? "inactive" : "active";

  try {
    const result = await loadCurrentStudents(view);
    await logAuditRequired({
      actor: staffActor(authorization.staff),
      action: "view",
      table: "portal_students,portal_student_people,portal_contact_methods,portal_instrument_requests",
      recordId: view,
      route: "/api/admin/current-students",
    });
    return json({ ...result, view });
  } catch (error) {
    console.error("[current-students] load failed:", error?.message || error);
    return json({ error: "Current student records could not be loaded or durably attributed." }, 503);
  }
}
