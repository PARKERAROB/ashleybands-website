import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAudit, staffActor } from "@/lib/auditLog";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { privateJson } from "@/lib/privateResponse";

export const runtime = "nodejs";

// Staff read of holiday raffle prize offers (#212). Offers hold donor contact details.
export async function GET(request) {
  const auth = await authorizeStaffRequest(request, STAFF_CAPABILITIES.RAFFLE_PRIZES_READ);
  if (!auth.ok) return privateJson({ error: auth.error }, auth.status);
  const { data, error } = await supabaseAdmin
    .from("raffle_prize_offers")
    .select("id,donor_name,business_name,contact,prize_description,estimated_value,source,created_at")
    .order("created_at", { ascending: false });
  if (error) return privateJson({ error: "Prize offers could not be loaded. Please try again." }, 503);
  await logAudit({ actor: staffActor(auth.staff), action: "raffle_prizes.view", table: "raffle_prize_offers", recordId: "all", changes: { count: data.length }, route: "/api/admin/raffle-prizes" });
  return privateJson({ offers: data });
}
