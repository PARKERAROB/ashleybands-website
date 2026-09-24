import { campaignGiftSummary, normalizeOfflineGiftInput } from "@/lib/sponsorCampaigns.mjs";
import { sponsorshipSummary, recognitionDraft } from "@/lib/sponsorOperations.mjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAudit, logAuditRequired, staffActor } from "@/lib/auditLog";
import { createPendingGift, parseGiftAmountCents } from "@/lib/sponsorGifts";
import { confirmGift } from "@/lib/sponsorRecognition";
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

function siteOrigin(req) {
  return process.env.NEXT_PUBLIC_SITE_ORIGIN || new URL(req.url).origin;
}

// Staff record an offline Carnegie gift already in hand (a check or cash from the band room), #103.
// The gift is created and confirmed in one staff action, receipted through the existing receipt
// path, and counted in the existing Carnegie total. Optional student credit comes from the check
// memo and is record-keeping only. Recognition is never auto-published.
export async function POST(req) {
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.SPONSORSHIP_GIFTS_WRITE);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  const staff = authorization.staff;

  const body = await req.json().catch(() => ({}));
  const amount = parseGiftAmountCents(body);
  if (amount.error) return privateJson({ error: amount.error }, 400);
  let input;
  try {
    input = normalizeOfflineGiftInput(body);
  } catch (error) {
    return privateJson({ error: String(error?.message || error) }, 400);
  }

  const staffName = staff.display_name || "staff";
  try {
    await logAuditRequired({
      actor: staffActor(staff),
      action: "offline_gift_record_requested",
      table: "sponsor_gifts",
      recordId: input.requestKey,
      route: "/api/sponsors/gifts",
      changes: { campaign_code: input.campaignCode, method: input.method, gift_kind: input.giftKind, student_credit: Boolean(input.studentId) },
    });
  } catch (error) {
    return privateServerError("sponsor-offline-gift-audit", error, "The gift could not be recorded.");
  }

  const created = await createPendingGift({
    amountCents: amount.cents,
    method: input.method,
    requestKey: input.requestKey,
    attributionToken: null,
    businessName: input.donorName,
    payerName: input.payerName,
    payerEmail: input.payerEmail,
    recordedBy: `staff:${staffName}`,
    campaignCode: input.campaignCode,
    giftKind: input.giftKind,
    termsVersion: null,
    staffStudentId: input.studentId,
    notes: `Offline ${input.method} recorded by ${staffName}.${input.memo ? ` Memo: ${input.memo}` : ""}`
  });
  if (created.error) return privateJson({ error: created.error }, created.status || 400);

  try {
    const result = await confirmGift(created.gift.id, {
      confirmedBy: staffName,
      origin: siteOrigin(req),
      listOnSite: false
    });
    return privateJson({ ok: true, existing: Boolean(created.existing), giftId: created.gift.id, alreadyConfirmed: Boolean(result?.alreadyConfirmed) });
  } catch (error) {
    return privateServerError("sponsor-offline-gift", error, "The gift was recorded but could not be confirmed. Confirm it from the pending list.");
  }
}
