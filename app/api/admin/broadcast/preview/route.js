import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { resolveAudience } from "@/lib/audience";
import { createAudienceConfirmation, enforcedBroadcastAudience } from "@/lib/broadcastAudienceConfirmation";
import { logAuditRequired, staffActor } from "@/lib/auditLog";
import { privateJson, privateServerError } from "@/lib/privateResponse";

export const runtime = "nodejs";

// Resolve an audience WITHOUT creating or sending anything. Powers the live
// recipient count + sample in the composer.
export async function POST(req) {
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.COMMUNICATIONS_READ);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);

  const body = await req.json().catch(() => ({}));
  const { audienceFilter, recipientAxis, directStudentId } = enforcedBroadcastAudience(body);
  try {
    const audience = await resolveAudience(audienceFilter, recipientAxis);
    await logAuditRequired({
      actor: staffActor(authorization.staff),
      action: "preview_broadcast_audience",
      table: "portal_students,portal_student_people,portal_contact_methods",
      recordId: directStudentId || `audience:${audience.studentCount}`,
      route: "/api/admin/broadcast/preview",
      changes: { direct_student_id: directStudentId || null, recipient_axis: recipientAxis, recipient_count: audience.count },
    });
    return privateJson({
      count: audience.count,
      studentCount: audience.studentCount,
      coveredStudentCount: audience.coveredStudentCount,
      sample: audience.recipients.slice(0, 10).map((row) => row.email),
      confirmationToken: createAudienceConfirmation({ staffId: authorization.staff.id, audienceFilter, recipientAxis, recipients: audience.recipients }),
    });
  } catch (error) {
    return privateServerError("broadcast-preview", error, "The broadcast audience could not be previewed or durably attributed.");
  }
}
