import { privateJson, privateServerError } from "@/lib/privateResponse";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAudit, staffActor } from "@/lib/auditLog";
import { carnegieLettersAccess, staffReportedGiftQueue } from "@/lib/carnegieLettersServer";

export const runtime = "nodejs";

// "Reported gifts to confirm" (#106). Same capability as the #103 staff offline gift form.
export async function GET(req) {
  const access = await carnegieLettersAccess(req);
  if (!access.open) return privateJson({ error: "Not found." }, 404);
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.SPONSORSHIP_GIFTS_WRITE);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  try {
    const reports = await staffReportedGiftQueue();
    await logAudit({ actor: staffActor(authorization.staff), action: "view", table: "carnegie_reported_gifts", recordId: "reported-gift-queue", route: "/api/admin/carnegie-reported-gifts" });
    return privateJson({ reports });
  } catch (error) {
    return privateServerError("carnegie-reported-gift-queue", error, "Reported gifts could not be loaded.");
  }
}
