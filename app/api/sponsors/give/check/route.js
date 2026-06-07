import { NextResponse } from "next/server";
import { sponsorFunnelLive } from "@/lib/sponsorFamily";
import { parseGiftAmountCents, createPendingGift } from "@/lib/sponsorGifts";
import { SPONSOR_CONTACT } from "@/lib/sponsorshipContent";

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

  const result = await createPendingGift({
    amountCents: amount.cents,
    method: "check",
    businessId: String(body.business_id || "").trim() || null,
    prospectId: String(body.prospect_id || "").trim() || null,
    businessName: body.business_name,
    payerName: body.payer_name,
    payerEmail: body.payer_email,
    recordedBy: "business_check_pledge"
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({
    ok: true,
    gift: { invoice_id: result.gift.invoice_id, tier: result.gift.tier },
    instructions: {
      payable_to: SPONSOR_CONTACT.boosterOrg,
      mail_to: `${SPONSOR_CONTACT.school}, ${SPONSOR_CONTACT.address}, ${SPONSOR_CONTACT.cityStateZip}`,
      memo: `Sponsorship — ref ${result.gift.invoice_id}`,
      note: "Write the reference on the memo line so we can match your check and send your receipt."
    }
  });
}
