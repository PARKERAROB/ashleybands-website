import { NextResponse } from "next/server";
import { isTrustedGuardian } from "@/lib/billing";
import { captureOrder, extractCapture } from "@/lib/paypal";
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
  try {
    const detail = extractCapture(await captureOrder(orderId));
    if (detail.captureStatus !== "COMPLETED" && detail.status !== "COMPLETED") return NextResponse.json({ error: "Payment was not completed." }, { status: 402 });
    await supabaseAdmin.from("portal_clothing_orders").update({ payment_status: "paid", paypal_capture_id: detail.captureId, paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", order.id);
    return NextResponse.json({ status: "paid" });
  } catch {
    return NextResponse.json({ error: "Could not confirm payment." }, { status: 502 });
  }
}

