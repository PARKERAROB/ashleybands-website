import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sponsorOnlineGiveLive } from "@/lib/sponsorFamily";
import { parseGiftAmountCents, createPendingGift } from "@/lib/sponsorGifts";
import { createOrder } from "@/lib/paypal";
import { normalizePublicGiftInput } from "@/lib/sponsorGiftPolicy.mjs";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

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

  let input;
  try {
    input = normalizePublicGiftInput(body);
  } catch (error) {
    return NextResponse.json({ error: String(error?.message || error) }, { status: 400 });
  }
  const rate = await checkRateLimit({
    key: `sponsor-order:${clientIp(req)}`,
    limit: 10,
    windowMs: 15 * 60 * 1000,
    failOpen: false
  });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many payment attempts. Please try again later." }, { status: 429 });
  }

  const result = await createPendingGift({
    amountCents: amount.cents,
    method: "online",
    requestKey: input.requestKey,
    attributionToken: String(body.attribution_token || "").trim() || null,
    businessName: input.businessName,
    payerName: input.payerName,
    payerEmail: input.payerEmail,
    recordedBy: "business_online"
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  if (result.existing && result.gift.paypal_order_id) {
    return NextResponse.json({ orderId: result.gift.paypal_order_id, invoiceId: result.gift.invoice_id });
  }
  if (result.existing) {
    return NextResponse.json({ error: "This payment is already starting. Please wait a moment." }, { status: 409 });
  }

  try {
    const order = await createOrder({
      amountCents: amount.cents,
      studentId: result.gift.id, // PayPal custom_id — our gift id, for reconciliation
      invoiceId: result.gift.invoice_id,
      description: `Sponsorship — ${result.gift.business_name}`.slice(0, 127),
      requestId: input.requestKey
    });
    const { error: updateError } = await supabaseAdmin
      .from("sponsor_gifts")
      .update({ paypal_order_id: order.id })
      .eq("id", result.gift.id);
    if (updateError) throw new Error("Could not attach the PayPal order to the sponsorship gift.");
    return NextResponse.json({ orderId: order.id, invoiceId: result.gift.invoice_id });
  } catch {
    // Roll the pending gift back so a failed order doesn't leave an orphan.
    await supabaseAdmin.from("sponsor_gifts").delete().eq("id", result.gift.id);
    return NextResponse.json({ error: "Could not start the PayPal gift. Please try again." }, { status: 502 });
  }
}
