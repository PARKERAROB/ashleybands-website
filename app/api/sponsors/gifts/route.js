import { campaignGiftSummary } from "@/lib/sponsorCampaigns.mjs";
import { sponsorshipSummary, recognitionDraft } from "@/lib/sponsorOperations.mjs";
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

  // Paginate so the displayed total cannot silently stop at the newest 200 gifts.
  const gifts = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabaseAdmin.from("sponsor_gifts")
      .select("id, campaign_code, gift_kind, gift_terms_version, business_name, amount_cents, method, status, tier, payer_name, payer_email, fmv_cents, deductible_cents, receipt_number, recognition_status, receipt_sent_at, badge_sent_at, listed_on_site, recorded_by, confirmed_at, created_at, student:portal_students(display_name, preferred_first, legal_first, legal_last)")
      .order("created_at", { ascending: false }).order("id").range(offset, offset + 499);
    if (error) return privateServerError("sponsor-gifts", error, "Sponsor gifts could not be loaded.");
    gifts.push(...(data || []));
    if ((data || []).length < 500) break;
  }
  const outreach = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabaseAdmin.from("business_outreach")
      .select("id, campaign, send_status").order("id").range(offset, offset + 499);
    if (error) return privateServerError("sponsor-gifts-outreach", error, "Sponsorship follow-up could not be loaded.");
    outreach.push(...(data || []));
    if ((data || []).length < 500) break;
  }
  const summary = sponsorshipSummary(gifts, outreach);
  await logAudit({ actor: staffActor(authorization.staff), action: "view", table: "sponsor_gifts,business_outreach", recordId: "gift-history", route: "/api/sponsors/gifts" });
  return privateJson({ gifts: gifts.map((gift) => ({ ...gift, recognitionDraft: recognitionDraft(gift) })), confirmedCents: summary.confirmedCents, carnegieSummary: campaignGiftSummary(gifts), summary });
}
