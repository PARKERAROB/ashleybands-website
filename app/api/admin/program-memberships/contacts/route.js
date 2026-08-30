import { NextResponse } from "next/server";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { loadMembershipContactEmails } from "@/lib/programMemberships";
import { logAuditRequired, staffActor } from "@/lib/auditLog";

export const runtime = "nodejs";

export async function POST(request) {
  const authorization = await authorizeStaffRequest(request, STAFF_CAPABILITIES.CONTACTS_EXPORT);
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  const body = await request.json().catch(() => ({}));
  const audience = String(body.audience || "");
  if (!["students", "guardians", "both"].includes(audience)) {
    return NextResponse.json({ error: "Choose students, guardians, or both." }, { status: 400 });
  }
  const studentIds = Array.isArray(body.studentIds) ? body.studentIds : [];
  if (!studentIds.length || studentIds.length > 250) {
    return NextResponse.json({ error: "Choose between 1 and 250 current students." }, { status: 400 });
  }

  try {
    const result = await loadMembershipContactEmails(studentIds, audience);
    await logAuditRequired({
      actor: staffActor(authorization.staff),
      action: "contact_export",
      table: "portal_students,portal_student_people,portal_contact_methods",
      recordId: `${result.studentCount}:${audience}`,
      changes: {
        requestedStudentCount: studentIds.length,
        subjectStudentIds: result.subjectStudentIds,
        audience,
        emailCount: result.emails.length,
      },
      route: "/api/admin/program-memberships/contacts",
    });
    return NextResponse.json(
      { emails: result.emails, studentCount: result.studentCount },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[program-memberships-contacts] load failed:", error?.message || error);
    return NextResponse.json({ error: "The selected contact list could not be prepared." }, { status: 500 });
  }
}
