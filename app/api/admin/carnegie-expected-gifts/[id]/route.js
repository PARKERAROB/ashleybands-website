import { privateJson, privateServerError } from "@/lib/privateResponse";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAudit, staffActor } from "@/lib/auditLog";
import { cancelExpectedGift, carnegieLettersAccess, confirmExpectedGift, loadExpectedGift } from "@/lib/carnegieLettersServer";

export const runtime = "nodejs";

function siteOrigin(req) {
  return process.env.NEXT_PUBLIC_SITE_ORIGIN || new URL(req.url).origin;
}

// Confirm when the money arrives (as expected, or adjusted) or cancel with a reason (#110).
export async function POST(req, { params }) {
  const access = await carnegieLettersAccess(req);
  if (!access.open) return privateJson({ error: "Not found." }, 404);
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.SPONSORSHIP_GIFTS_WRITE);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  try {
    const { id } = await params;
    const item = await loadExpectedGift(id);
    if (!item) return privateJson({ error: "Expected gift not found." }, 404);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return privateJson({ error: "Send the action as JSON." }, 400);
    const action = String(body.action || "");
    let result;
    if (action === "confirm") result = await confirmExpectedGift(authorization.staff, item, body, siteOrigin(req));
    else if (action === "cancel") result = await cancelExpectedGift(authorization.staff, item, body);
    else return privateJson({ error: "Unknown action." }, 400);
    if (result.error) return privateJson({ error: result.error }, result.status);
    await logAudit({ actor: staffActor(authorization.staff), action: `expected_gift.${action}`, table: "carnegie_expected_gifts", recordId: item.id, changes: { from: item.status, to: result.item?.status, amount_cents: item.amount_cents, confirmed_amount_cents: result.item?.confirmed_amount_cents ?? null, sponsor_gift_id: result.item?.sponsor_gift_id ?? null, already_confirmed: Boolean(result.alreadyConfirmed) }, route: "/api/admin/carnegie-expected-gifts/[id]" });
    return privateJson({ item: result.item, alreadyConfirmed: Boolean(result.alreadyConfirmed) });
  } catch (error) {
    return privateServerError("carnegie-expected-gift-review", error, "The expected gift could not be updated.");
  }
}
