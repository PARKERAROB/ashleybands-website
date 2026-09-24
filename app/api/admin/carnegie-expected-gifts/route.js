import { privateJson, privateServerError } from "@/lib/privateResponse";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAudit, staffActor } from "@/lib/auditLog";
import { carnegieLettersAccess, createExpectedGift, staffExpectedGifts } from "@/lib/carnegieLettersServer";

export const runtime = "nodejs";

// Expected Carnegie gifts (#110). Same capability as the #103 staff offline gift form.
export async function GET(req) {
  const access = await carnegieLettersAccess(req);
  if (!access.open) return privateJson({ error: "Not found." }, 404);
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.SPONSORSHIP_GIFTS_WRITE);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  try {
    const items = await staffExpectedGifts();
    await logAudit({ actor: staffActor(authorization.staff), action: "view", table: "carnegie_expected_gifts", recordId: "expected-gift-list", route: "/api/admin/carnegie-expected-gifts" });
    return privateJson({ items });
  } catch (error) {
    return privateServerError("carnegie-expected-gifts", error, "Expected gifts could not be loaded.");
  }
}

export async function POST(req) {
  const access = await carnegieLettersAccess(req);
  if (!access.open) return privateJson({ error: "Not found." }, 404);
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.SPONSORSHIP_GIFTS_WRITE);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return privateJson({ error: "Send the expected gift as JSON." }, 400);
  try {
    const result = await createExpectedGift(authorization.staff, body);
    if (result.error) return privateJson({ error: result.error }, result.status);
    await logAudit({ actor: staffActor(authorization.staff), action: "create", table: "carnegie_expected_gifts", recordId: result.item.id, changes: { amount_cents: result.item.amount_cents, method: result.item.method, student_credit: Boolean(result.item.portal_student_id) }, route: "/api/admin/carnegie-expected-gifts" });
    return privateJson({ item: result.item }, 201);
  } catch (error) {
    return privateServerError("carnegie-expected-gift-create", error, "The expected gift could not be saved.");
  }
}
