import { privateJson, privateServerError } from "@/lib/privateResponse";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAudit, staffActor } from "@/lib/auditLog";
import { carnegieLettersAccess, confirmReportedGift, loadReportedGift, rejectReportedGift } from "@/lib/carnegieLettersServer";

export const runtime = "nodejs";

function siteOrigin(req) {
  return process.env.NEXT_PUBLIC_SITE_ORIGIN || new URL(req.url).origin;
}

// Confirm (as reported, or with an adjusted amount or method) or reject with a reason (#106).
// Confirm uses the #103 offline gift path; a repeat click returns the same single gift.
export async function POST(req, { params }) {
  const access = await carnegieLettersAccess(req);
  if (!access.open) return privateJson({ error: "Not found." }, 404);
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.SPONSORSHIP_GIFTS_WRITE);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  try {
    const { id } = await params;
    const report = await loadReportedGift(id);
    if (!report) return privateJson({ error: "Report not found." }, 404);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return privateJson({ error: "Send the action as JSON." }, 400);
    const action = String(body.action || "");
    let result;
    if (action === "confirm") result = await confirmReportedGift(authorization.staff, report, body, siteOrigin(req));
    else if (action === "reject") result = await rejectReportedGift(authorization.staff, report, body);
    else return privateJson({ error: "Unknown action." }, 400);
    if (result.error) return privateJson({ error: result.error }, result.status);
    await logAudit({ actor: staffActor(authorization.staff), action: `reported_gift.${action}`, table: "carnegie_reported_gifts", recordId: report.id, changes: { from: report.status, to: result.report?.status, reported_amount_cents: report.reported_amount_cents, confirmed_amount_cents: result.report?.confirmed_amount_cents ?? null, sponsor_gift_id: result.report?.sponsor_gift_id ?? null, already_confirmed: Boolean(result.alreadyConfirmed) }, route: "/api/admin/carnegie-reported-gifts/[id]" });
    return privateJson({ report: result.report, alreadyConfirmed: Boolean(result.alreadyConfirmed) });
  } catch (error) {
    return privateServerError("carnegie-reported-gift-review", error, "The report could not be updated.");
  }
}
