import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyWebhookSignature } from "@/lib/paypal";

export const runtime = "nodejs";

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

  // Idempotency: record the event id; if it already exists, ack and stop.
  const eventId = String(event.id || "");
  if (eventId) {
    const { error: dupeError } = await supabaseAdmin
      .from("paypal_webhook_events")
      .insert({
        event_id: eventId,
        event_type: String(event.event_type || ""),
        resource_id: String(event.resource?.id || "")
      });
    if (dupeError) {
      // unique violation => already processed
      return NextResponse.json({ ok: true, duplicate: true });
    }
  }

  const resource = event.resource || {};

  if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    const invoiceId = resource.invoice_id || "";
    if (invoiceId) {
      await supabaseAdmin
        .from("fee_payments")
        .update({
          status: "completed",
          paypal_capture_id: resource.id || "",
          received_at: new Date().toISOString()
        })
        .eq("invoice_id", invoiceId)
        .eq("status", "pending");
    }
  } else if (
    event.event_type === "PAYMENT.CAPTURE.REFUNDED" ||
    event.event_type === "PAYMENT.CAPTURE.REVERSED"
  ) {
    // Refund resource carries invoice_id in most cases; fall back to the related
    // capture id parsed from the "up" link.
    const invoiceId = resource.invoice_id || "";
    if (invoiceId) {
      await supabaseAdmin
        .from("fee_payments")
        .update({ status: "refunded" })
        .eq("invoice_id", invoiceId)
        .eq("status", "completed");
    } else {
      const upLink = (resource.links || []).find((l) => l.rel === "up");
      const captureId = upLink?.href ? upLink.href.split("/").pop() : "";
      if (captureId) {
        await supabaseAdmin
          .from("fee_payments")
          .update({ status: "refunded" })
          .eq("paypal_capture_id", captureId)
          .eq("status", "completed");
      }
    }
  }

  return NextResponse.json({ ok: true });
}
