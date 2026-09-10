import { normalizeGiftPurpose, giftCampaignLabel, CARNEGIE_CAMPAIGN } from "@/lib/sponsorCampaigns.mjs";
import { NextResponse } from "next/server";
import { sponsorFunnelLive } from "@/lib/sponsorFamily";
import { parseGiftAmountCents, createPendingGift } from "@/lib/sponsorGifts";
import { SPONSOR_CONTACT } from "@/lib/sponsorshipContent";
import { normalizePublicGiftInput } from "@/lib/sponsorGiftPolicy.mjs";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

// Check give path (build-spec §5): public, no auth. Records a PENDING check gift so the
// booster knows it's coming and can match it on arrival, and returns the mailing
// instructions. Staff confirms the gift (fires Lane A recognition) when the check lands.
export async function POST(req) {
  if (!sponsorFunnelLive()) {
    return NextResponse.json({ error: "Sponsorship giving is not open yet." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const amount = parseGiftAmountCents(body);
  if (amount.error) return NextResponse.json({ error: amount.error }, { status: 400 });

  let input;
  let purpose;
  try {
    input = normalizePublicGiftInput(body);
    purpose = normalizeGiftPurpose(body);
    if (purpose.campaignCode === CARNEGIE_CAMPAIGN && !input.payerEmail) throw new Error("Enter your email for the receipt and any trip updates.");
  } catch (error) {
    return NextResponse.json({ error: String(error?.message || error) }, { status: 400 });
  }
  const rate = await checkRateLimit({
    key: `sponsor-check:${clientIp(req)}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
    failOpen: false
  });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many check requests. Please try again later." }, { status: 429 });
  }

  const result = await createPendingGift({
    campaignCode: purpose.campaignCode,
    giftKind: purpose.giftKind,
    termsVersion: body.gift_terms_version,
    amountCents: amount.cents,
    method: "check",
    requestKey: input.requestKey,
    attributionToken: String(body.attribution_token || "").trim() || null,
    businessName: input.businessName,
    payerName: input.payerName,
    payerEmail: input.payerEmail,
    recordedBy: "business_check_pledge"
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 400 });

  return NextResponse.json({
    ok: true,
    gift: { invoice_id: result.gift.invoice_id, tier: result.gift.tier },
    instructions: {
      payable_to: SPONSOR_CONTACT.boosterOrg,
      mail_to: `${SPONSOR_CONTACT.school}, ${SPONSOR_CONTACT.address}, ${SPONSOR_CONTACT.cityStateZip}`,
      memo: `${giftCampaignLabel(result.gift.campaign_code)} / ref ${result.gift.invoice_id}`,
      note: "Write the reference on the memo line so we can match your check and send your receipt."
    }
  });
}
