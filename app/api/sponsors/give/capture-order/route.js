import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sponsorOnlineGiveLive } from "@/lib/sponsorFamily";
import { captureOrder, extractCapture } from "@/lib/paypal";
import { confirmGift, dollars } from "@/lib/sponsorRecognition";

export const runtime = "nodejs";

// Online give — step 2 (item D): capture the approved PayPal order, then fire Lane A
// recognition (receipt + auto-listing + badge) via confirmGift. Idempotent on the gift:
// confirmGift no-ops if the gift is already confirmed.
function siteOrigin(req) {
  return process.env.NEXT_PUBLIC_SITE_ORIGIN || new URL(req.url).origin;
}

export async function POST(req) {
  if (!sponsorOnlineGiveLive()) {
    return NextResponse.json({ error: "Online giving isn't available yet." }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const orderId = String(body.orderId || body.order_id || "").trim();
  if (!orderId) return NextResponse.json({ error: "Missing order." }, { status: 400 });

  const { data: gift } = await supabaseAdmin
    .from("sponsor_gifts")
    .select("id, status, amount_cents, business_name")
    .eq("paypal_order_id", orderId)
    .maybeSingle();
  if (!gift) return NextResponse.json({ error: "No gift matches that order." }, { status: 404 });

  let capture;
  try {
    const captured = await captureOrder(orderId);
    capture = extractCapture(captured);
  } catch (err) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 502 });
  }

  if (capture.captureStatus !== "COMPLETED") {
    return NextResponse.json({ error: `Payment not completed (${capture.captureStatus}).` }, { status: 402 });
  }

  await supabaseAdmin
    .from("sponsor_gifts")
    .update({ paypal_capture_id: capture.captureId })
    .eq("id", gift.id);

  const result = await confirmGift(gift.id, { confirmedBy: "paypal", origin: siteOrigin(req) });

  return NextResponse.json({
    ok: true,
    amount: dollars(gift.amount_cents),
    business: gift.business_name,
    tier: result.gift?.tier || null,
    receiptNumber: result.gift?.receipt_number || null,
    recognition: result.recognitionStatus || (result.alreadyConfirmed ? "already" : "queued_dark")
  });
}
