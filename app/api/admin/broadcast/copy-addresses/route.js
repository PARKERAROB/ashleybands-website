import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { resolveAudienceAddresses } from "@/lib/audience";
import { enforcedBroadcastAudience } from "@/lib/broadcastAudienceConfirmation";
import { logAuditRequired, staffActor } from "@/lib/auditLog";
import { privateJson, privateServerError } from "@/lib/privateResponse";

export const runtime = "nodejs";

// #209: copy a broadcast audience's addresses for an Outlook Bcc. Same filters
// and resolver as the preview, opt-outs removed. Sends nothing. The audit row
// records who, filter and counts, never addresses.
export async function POST(req) {
  const authorization = await authorizeStaffRequest(req, [STAFF_CAPABILITIES.COMMUNICATIONS_READ, STAFF_CAPABILITIES.CONTACTS_EXPORT]);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);

  const body = await req.json().catch(() => ({}));
  const { audienceFilter, recipientAxis, directStudentId } = enforcedBroadcastAudience(body);
  try {
    const result = await resolveAudienceAddresses(audienceFilter, recipientAxis);
    await logAuditRequired({
      actor: staffActor(authorization.staff),
      action: "copy_audience_addresses",
      table: "portal_students,portal_student_people,portal_contact_methods,contact_suppressions",
      recordId: directStudentId || `audience:${result.studentCount}`,
      route: "/api/admin/broadcast/copy-addresses",
      changes: { audience_filter: audienceFilter, recipient_axis: recipientAxis, recipient_count: result.count, suppressed_count: result.suppressedCount },
    });
    return privateJson({ addresses: result.addresses, count: result.count, suppressedCount: result.suppressedCount });
  } catch (error) {
    return privateServerError("broadcast-copy-addresses", error, "The addresses could not be prepared. Nothing was copied.");
  }
}
