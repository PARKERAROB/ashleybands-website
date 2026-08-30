import { NextResponse } from "next/server";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { loadProgramMemberships } from "@/lib/programMemberships";
import { logAudit, staffActor } from "@/lib/auditLog";

export const runtime = "nodejs";

export async function GET(request) {
  const authorization = await authorizeStaffRequest(request, STAFF_CAPABILITIES.MEMBERSHIPS_READ);
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  try {
    const result = await loadProgramMemberships();
    await logAudit({
      actor: staffActor(authorization.staff),
      action: "view",
      table: "program_groups,program_memberships,school_class_sections,student_class_enrollments",
      recordId: "current",
      route: "/api/admin/program-memberships",
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[program-memberships] load failed:", error?.message || error);
    return NextResponse.json({ error: "Current program memberships could not be loaded." }, { status: 500 });
  }
}
