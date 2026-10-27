import { privateJson } from "@/lib/privateResponse";
import { readPortalSession } from "@/lib/portalTokens";
import { isTrustedGuardian } from "@/lib/billing";
import { logAudit } from "@/lib/auditLog";
import { createReportedPayment, validateReportedPayment } from "@/lib/carnegieReportedPayments";

export const runtime = "nodejs";

// A family records a Carnegie check or cash they handed in (#237). Pending until deposited.
export async function POST(request) {
  const session = readPortalSession(request);
  if (!session?.personId) return privateJson({ error: "Sign in first." }, 401);
  const body = await request.json().catch(() => ({}));
  const studentId = String(body.studentId || "");
  if (!studentId || !await isTrustedGuardian(session.personId, studentId)) {
    return privateJson({ error: "A verified parent or guardian must record payments for this student." }, 403);
  }
  const fields = validateReportedPayment(body);
  if (fields.error) return privateJson({ error: fields.error }, 400);
  try {
    const result = await createReportedPayment({ session, studentId, fields });
    await logAudit({
      actor: { type: "parent", id: session.personId, name: session.email },
      action: "report_carnegie_payment",
      table: "fee_payments",
      recordId: result.id,
      changes: { category: fields.category, method: fields.method, amount_cents: fields.amountCents },
      route: "/api/portal/carnegie-payment-report",
    });
    return privateJson({ ok: true, reference: result.reference }, 201);
  } catch (error) {
    console.error("[carnegie-payment-report]", error?.message);
    return privateJson({ error: "The payment note could not be saved. Please try again." }, 500);
  }
}
