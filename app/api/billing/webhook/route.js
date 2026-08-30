import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { amountToCents, extractCapture, getOrder, verifyWebhookSignature } from "@/lib/paypal";
import { confirmGift } from "@/lib/sponsorRecognition";
import { paypalCaptureMatchesGift, webhookSettlementPlan } from "@/lib/sponsorGiftPolicy.mjs";

export const runtime = "nodejs";

function siteOrigin(request) {
  return process.env.NEXT_PUBLIC_SITE_ORIGIN || new URL(request.url).origin;
}

async function settleSponsorCapture(resource, request) {
  const invoiceId = String(resource.invoice_id || "");
  const { data: gift, error } = await supabaseAdmin
    .from("sponsor_gifts")
    .select("id, invoice_id, amount_cents, status, paypal_order_id")
    .eq("invoice_id", invoiceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!gift) throw new Error("Sponsor gift not found for PayPal invoice.");

  const orderId = resource.supplementary_data?.related_ids?.order_id || gift.paypal_order_id;
  if (!orderId) throw new Error("PayPal order id is missing from sponsor capture.");
  const order = await getOrder(orderId);
  const capture = extractCapture(order);
  if (!paypalCaptureMatchesGift(capture, gift, amountToCents)) {
    throw new Error("PayPal sponsor capture does not match the stored gift.");
  }

  const verifiedEmail = String(capture.payerEmail || "").trim().toLowerCase();
  const verifiedName = String(capture.payerName || "").trim();
  const { error: updateError } = await supabaseAdmin
    .from("sponsor_gifts")
    .update({
      paypal_order_id: orderId,
      paypal_capture_id: resource.id || capture.captureId,
      payer_email: verifiedEmail,
      payer_name: verifiedName
    })
    .eq("id", gift.id);
  if (updateError) throw new Error(updateError.message);

  await confirmGift(gift.id, {
    confirmedBy: "paypal_webhook",
    origin: siteOrigin(request),
    listOnSite: false,
    receiptEmail: verifiedEmail || null
  });
}

async function refundSponsorGift(resource) {
  const invoiceId = String(resource.invoice_id || "");
  let query = supabaseAdmin
    .from("sponsor_gifts")
    .update({ status: "refunded", listed_on_site: false });
  if (invoiceId) {
    query = query.eq("invoice_id", invoiceId);
  } else {
    const upLink = (resource.links || []).find((link) => link.rel === "up");
    const captureId = upLink?.href ? upLink.href.split("/").pop() : "";
    if (!captureId) throw new Error("Refund has no sponsor invoice or capture id.");
    query = query.eq("paypal_capture_id", captureId);
  }
  const { data, error } = await query.eq("status", "confirmed").select("id");
  if (error) throw new Error(error.message);
  return Boolean(data?.length);
}

// PayPal posts payment lifecycle events here. This is the reconciliation source
// of truth — it settles payments even if the browser closed mid-capture.
export async function POST(request) {
  let event;
  try {
    event = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const headers = {
    "paypal-auth-algo": request.headers.get("paypal-auth-algo"),
    "paypal-cert-url": request.headers.get("paypal-cert-url"),
    "paypal-transmission-id": request.headers.get("paypal-transmission-id"),
    "paypal-transmission-sig": request.headers.get("paypal-transmission-sig"),
    "paypal-transmission-time": request.headers.get("paypal-transmission-time")
  };

  let verified = false;
  try {
    verified = await verifyWebhookSignature({ headers, body: event });
  } catch {
    verified = false;
  }
  if (!verified) {
    return NextResponse.json({ error: "Signature verification failed." }, { status: 401 });
  }

  // Reserve the event id before processing. A processing failure removes the reservation so
  // PayPal's retry can repair a transient database or email-provider failure.
  const eventId = String(event.id || "");
  let reserved = false;
  if (eventId) {
    const { error: dupeError } = await supabaseAdmin
      .from("paypal_webhook_events")
      .insert({
        event_id: eventId,
        event_type: String(event.event_type || ""),
        resource_id: String(event.resource?.id || "")
      });
    if (dupeError) {
      if (dupeError.code === "23505") {
        return NextResponse.json({ ok: true, duplicate: true });
      }
      return NextResponse.json({ error: "Could not reserve webhook event." }, { status: 503 });
    }
    reserved = true;
  }

  const resource = event.resource || {};
  try {
    const invoiceId = String(resource.invoice_id || "");
    const plan = webhookSettlementPlan(event.event_type, invoiceId);
    if (plan?.ledger === "sponsor" && plan.status === "confirmed") {
      await settleSponsorCapture(resource, request);
    } else if (plan?.ledger === "sponsor" && plan.status === "refunded") {
      await refundSponsorGift(resource);
    } else if (plan?.ledger === "family" && plan.status === "completed" && invoiceId) {
      const { data: payment, error: paymentError } = await supabaseAdmin
        .from("fee_payments")
        .select("id,student_id,invoice_id,amount_cents,kind,status")
        .eq("invoice_id", invoiceId)
        .maybeSingle();
      if (paymentError || !payment) throw new Error(paymentError?.message || "Family payment not found.");
      if (
        payment.kind !== "fee"
        || amountToCents(resource.amount?.value) !== Number(payment.amount_cents)
        || resource.amount?.currency_code !== "USD"
        || (resource.custom_id && resource.custom_id !== payment.student_id)
      ) throw new Error("PayPal family capture does not match the stored fee payment.");
      if (payment.status === "pending") {
        const { error } = await supabaseAdmin.rpc("settle_online_fee_payment_with_audit", {
          p_payment_id: payment.id,
          p_capture_id: resource.id || "",
          p_actor_type: "system",
          p_actor_id: eventId || null,
          p_actor_name: "PayPal webhook",
          p_route: "/api/billing/webhook",
        });
        if (error) throw new Error(error.message);
      }
    } else if (plan?.ledger === "family" && plan.status === "refunded") {
      if (!invoiceId && await refundSponsorGift(resource)) {
        return NextResponse.json({ ok: true });
      }
      let query = supabaseAdmin.from("fee_payments").update({ status: "refunded" });
      if (invoiceId) {
        query = query.eq("invoice_id", invoiceId);
      } else {
        const upLink = (resource.links || []).find((link) => link.rel === "up");
        const captureId = upLink?.href ? upLink.href.split("/").pop() : "";
        if (!captureId) throw new Error("Refund has no family invoice or capture id.");
        query = query.eq("paypal_capture_id", captureId);
      }
      const { error } = await query.eq("status", "completed");
      if (error) throw new Error(error.message);
    }
  } catch {
    if (reserved) await supabaseAdmin.from("paypal_webhook_events").delete().eq("event_id", eventId);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
