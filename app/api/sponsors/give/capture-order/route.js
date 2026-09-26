import { CARNEGIE_CAMPAIGN, campaignOnlineReady } from "@/lib/sponsorCampaigns.mjs";
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
// Donor-facing capture messages (#125). Raw PayPal/API text never reaches the donor; the
// details are logged on the server for reconciliation.
const CAPTURE_DECLINED_MESSAGE = "Your payment didn't go through, and you have not been charged. Try another card or PayPal option, or choose Pay by check.";
const CAPTURE_UNCONFIRMED_MESSAGE = "We couldn't confirm this payment. Please don't pay again. Email Mr. Parker at robert.parker@nhcs.net and he'll check it.";
const CAPTURE_PENDING_MESSAGE = "PayPal is still processing this payment. Please don't pay again. You'll get a receipt by email when it clears.";
const CAPTURE_MISMATCH_MESSAGE = "Something didn't match on this payment. Please don't pay again. Email Mr. Parker at robert.parker@nhcs.net and he'll sort it out.";

// PayPal answered with an error response (for example a declined card), so no money moved.
// ORDER_ALREADY_CAPTURED and transport errors are not proof of that, so they get the
// "don't pay again" message instead.
function captureFailureMessage(err) {
  const text = String(err?.message || err || "");
  if (/^PayPal capture failed \((4\d\d)\)/.test(text) && !/ORDER_ALREADY_CAPTURED/.test(text)) return CAPTURE_DECLINED_MESSAGE;
  return CAPTURE_UNCONFIRMED_MESSAGE;
}

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
    .select("id, campaign_code, status, amount_cents, business_name, invoice_id, receipt_number, recognition_status")
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

  if (gift.campaign_code === CARNEGIE_CAMPAIGN && !campaignOnlineReady(process.env)) {
    return NextResponse.json({ error: "Online trip giving is temporarily unavailable. Please contact Mr. Parker before retrying." }, { status: 503 });
  }

  let capture;
  try {
    const captured = await captureOrder(orderId);
    capture = extractCapture(captured);
  } catch (err) {
    console.error("sponsor capture failed", { giftId: gift.id, orderId, error: String(err?.message || err) });
    return NextResponse.json({ error: captureFailureMessage(err) }, { status: 502 });
  }

  if (capture.captureStatus !== "COMPLETED") {
    console.error("sponsor capture not completed", { giftId: gift.id, orderId, captureStatus: capture.captureStatus });
    const pending = capture.captureStatus === "PENDING";
    return NextResponse.json({ error: pending ? CAPTURE_PENDING_MESSAGE : CAPTURE_DECLINED_MESSAGE }, { status: 402 });
  }
  const identityMatches = paypalCaptureMatchesGift(capture, gift, amountToCents);
  if (!identityMatches) {
    console.error("sponsor capture mismatch", { giftId: gift.id, orderId, captureId: capture.captureId });
    return NextResponse.json({ error: CAPTURE_MISMATCH_MESSAGE }, { status: 409 });
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
