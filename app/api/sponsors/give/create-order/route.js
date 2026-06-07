import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sponsorOnlineGiveLive } from "@/lib/sponsorFamily";
import { parseGiftAmountCents, createPendingGift } from "@/lib/sponsorGifts";
import { createOrder } from "@/lib/paypal";

export const runtime = "nodejs";

// Online give — step 1 (build-spec §5, item D): create a PayPal order for a sponsorship
// gift (NOT a student fee — separate ledger). Public, no auth: the business is giving.
// Gated by sponsorOnlineGiveLive() (funnel flag + PayPal creds). The check path needs no
// processor and stays available even when this is dark.
export async function POST(req) {
  if (!sponsorOnlineGiveLive()) {
    return NextResponse.json(
      { error: "Online giving isn't available yet — pay by check, or contact the director." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const amount = parseGiftAmountCents(body);
  if (amount.error) return NextResponse.json({ error: amount.error }, { status: 400 });

  const result = await createPendingGift({
    amountCents: amount.cents,
    method: "online",
    businessId: String(body.business_id || "").trim() || null,
    prospectId: String(body.prospect_id || "").trim() || null,
    businessName: body.business_name,
    payerName: body.payer_name,
    payerEmail: body.payer_email,
    recordedBy: "business_online"
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  try {
    const order = await createOrder({
      amountCents: amount.cents,
      studentId: result.gift.id, // PayPal custom_id — our gift id, for reconciliation
      invoiceId: result.gift.invoice_id,
      description: `Sponsorship — ${result.gift.business_name}`.slice(0, 127)
    });
    await supabaseAdmin
      .from("sponsor_gifts")
      .update({ paypal_order_id: order.id })
      .eq("id", result.gift.id);
    return NextResponse.json({ orderId: order.id, invoiceId: result.gift.invoice_id });
  } catch (err) {
    // Roll the pending gift back so a failed order doesn't leave an orphan.
    await supabaseAdmin.from("sponsor_gifts").delete().eq("id", result.gift.id);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 502 });
  }
}
