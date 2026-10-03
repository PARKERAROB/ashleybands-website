import { NextResponse } from "next/server";
import { isTrustedGuardian } from "@/lib/billing";
import { captureOrder, extractCapture, getOrder, paypalCaptureCompleted } from "@/lib/paypal";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readPortalSession } from "@/lib/portalTokens";

export const runtime = "nodejs";

export async function POST(request) {
  const session = readPortalSession(request);
  if (!session?.personId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const orderId = String(body.orderId || "");
  const { data: order } = await supabaseAdmin.from("portal_clothing_orders").select("id,student_id,payment_status").eq("paypal_order_id", orderId).maybeSingle();
  if (!order || !(await isTrustedGuardian(session.personId, order.student_id))) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.payment_status === "paid") return NextResponse.json({ status: "paid" });
  let detail;
  try {
    detail = extractCapture(await captureOrder(orderId));
  } catch {
    // PayPal refuses a second capture. Read the order so a retry can record a capture that already happened.
    try {
      detail = extractCapture(await getOrder(orderId));
    } catch {
      return NextResponse.json({ error: "Could not confirm payment." }, { status: 502 });
    }
  }
  if (!paypalCaptureCompleted(detail)) {
    if (detail.captureStatus === "PENDING") return NextResponse.json({ status: "pending" }, { status: 202 });
    return NextResponse.json({ error: "Payment was not completed." }, { status: 402 });
  }
  const nowIso = new Date().toISOString();
  const { error } = await supabaseAdmin.from("portal_clothing_orders").update({ payment_status: "paid", paypal_capture_id: detail.captureId, paid_at: nowIso, updated_at: nowIso }).eq("id", order.id);
  if (error) {
    console.error("[clothing-capture] paid order could not be recorded:", error.message);
    return NextResponse.json({ error: "PayPal took the payment, but the order could not be marked paid yet. Try again in a minute, or email Mr. Parker." }, { status: 500 });
  }
  return NextResponse.json({ status: "paid" });
}
