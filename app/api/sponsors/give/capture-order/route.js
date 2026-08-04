import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sponsorOnlineGiveLive } from "@/lib/sponsorFamily";
import { amountToCents, captureOrder, extractCapture } from "@/lib/paypal";
import { confirmGift, dollars } from "@/lib/sponsorRecognition";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { paypalCaptureMatchesGift } from "@/lib/sponsorGiftPolicy.mjs";

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
  if (!/^[A-Z0-9-]{8,64}$/i.test(orderId)) {
    return NextResponse.json({ error: "Missing or invalid order." }, { status: 400 });
  }
  const rate = await checkRateLimit({
    key: `sponsor-capture:${clientIp(req)}`,
    limit: 15,
    windowMs: 15 * 60 * 1000,
    failOpen: false
  });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many payment attempts. Please try again later." }, { status: 429 });
  }

  const { data: gift } = await supabaseAdmin
    .from("sponsor_gifts")
    .select("id, status, amount_cents, business_name, invoice_id, receipt_number, recognition_status")
    .eq("paypal_order_id", orderId)
    .maybeSingle();
  if (!gift) return NextResponse.json({ error: "No gift matches that order." }, { status: 404 });
  if (gift.status === "confirmed") {
    return NextResponse.json({
      ok: true,
      amount: dollars(gift.amount_cents),
      business: gift.business_name,
      receiptNumber: gift.receipt_number || null,
      recognition: gift.recognition_status || "already"
    });
  }

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
  const identityMatches = paypalCaptureMatchesGift(capture, gift, amountToCents);
  if (!identityMatches) {
    return NextResponse.json({ error: "PayPal returned payment details that do not match this gift." }, { status: 409 });
  }

  const verifiedEmail = String(capture.payerEmail || "").trim().toLowerCase();
  const verifiedName = String(capture.payerName || "").trim();

  const { error: updateError } = await supabaseAdmin
    .from("sponsor_gifts")
    .update({
      paypal_capture_id: capture.captureId,
      payer_email: verifiedEmail,
      payer_name: verifiedName
    })
    .eq("id", gift.id);
  if (updateError) {
    return NextResponse.json({
      ok: true,
      pending: true,
      business: gift.business_name,
      amount: dollars(gift.amount_cents),
      recognition: "reconciling"
    }, { status: 202 });
  }

  const result = await confirmGift(gift.id, {
    confirmedBy: "paypal",
    origin: siteOrigin(req),
    listOnSite: false,
    receiptEmail: verifiedEmail || null
  });

  return NextResponse.json({
    ok: true,
    amount: dollars(gift.amount_cents),
    business: gift.business_name,
    tier: result.gift?.tier || null,
    receiptNumber: result.gift?.receipt_number || null,
    recognition: result.recognitionStatus || (result.alreadyConfirmed ? "already" : "queued_dark")
  });
}
