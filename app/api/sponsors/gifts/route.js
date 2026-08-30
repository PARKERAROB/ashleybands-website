import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAudit, staffActor } from "@/lib/auditLog";
import { privateJson, privateServerError } from "@/lib/privateResponse";

export const runtime = "nodejs";

// Staff gift list for the sponsorship dashboard. Pending check pledges that need confirming
// on arrival, plus the confirmed history. Staff-only.
export async function GET(req) {
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.SPONSORSHIP_READ);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);

  const { data, error } = await supabaseAdmin
    .from("sponsor_gifts")
    .select(
      "id, business_name, amount_cents, method, status, tier, payer_name, payer_email, fmv_cents, deductible_cents, receipt_number, recognition_status, listed_on_site, recorded_by, confirmed_at, created_at, student:portal_students(display_name, preferred_first, legal_first, legal_last)"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return privateServerError("sponsor-gifts", error, "Sponsor gifts could not be loaded.");

  const gifts = data || [];
  const confirmedCents = gifts
    .filter((g) => g.status === "confirmed")
    .reduce((sum, g) => sum + (g.amount_cents || 0), 0);
  await logAudit({ actor: staffActor(authorization.staff), action: "view", table: "sponsor_gifts", recordId: "gift-history", route: "/api/sponsors/gifts" });
  return privateJson({ gifts, confirmedCents });
}
