import { privateJson, privateServerError } from "@/lib/privateResponse";
import { logAudit } from "@/lib/auditLog";
import { carnegieLettersAccess, createReportedGift, familyActor, portalPerson } from "@/lib/carnegieLettersServer";

export const runtime = "nodejs";

// A family reports cash or a check the student collected (#106). Unverified: it counts nowhere
// and sends no receipt until staff confirm it.
export async function POST(req) {
  const access = await carnegieLettersAccess(req);
  if (!access.open) return privateJson({ error: "Not found." }, 404);
  const session = portalPerson(req);
  if (!session) return privateJson({ error: "Sign in to the Family Portal first." }, 401);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return privateJson({ error: "Send the report as JSON." }, 400);
  try {
    const result = await createReportedGift(session.personId, body);
    if (result.error) return privateJson({ error: result.error }, result.status);
    await logAudit({ actor: familyActor(session), action: "report", table: "carnegie_reported_gifts", recordId: result.report.id, changes: { reported_amount_cents: result.report.reported_amount_cents, reported_method: result.report.reported_method }, route: "/api/portal/carnegie-notes/reported-gifts" });
    return privateJson({ report: result.report }, 201);
  } catch (error) {
    return privateServerError("carnegie-reported-gift", error, "The gift report could not be saved.");
  }
}
