import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readPortalSession } from "@/lib/portalTokens";
import { isTrustedGuardian, generateInvoiceId } from "@/lib/billing";
import { createOrder, isPaypalConfigured } from "@/lib/paypal";

export const runtime = "nodejs";

const MAX_PAYMENT_CENTS = 1_000_000; // $10,000 sanity cap

export async function POST(request) {
  const session = readPortalSession(request);
  if (!session?.personId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!isPaypalConfigured()) {
    return NextResponse.json({ error: "Online payments are not configured yet." }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const studentId = String(body.studentId || "");
  const amountCents = Math.round(Number(body.amountCents) || 0);

  if (!studentId) {
    return NextResponse.json({ error: "Missing student." }, { status: 400 });
  }
  if (!Number.isFinite(amountCents) || amountCents <= 0 || amountCents > MAX_PAYMENT_CENTS) {
    return NextResponse.json({ error: "Enter a valid payment amount." }, { status: 400 });
  }

  const allowed = await isTrustedGuardian(session.personId, studentId);
  if (!allowed) {
    return NextResponse.json({ error: "Not authorized for this student." }, { status: 403 });
  }

  // Look up the student name for the PayPal description.
  const { data: student } = await supabaseAdmin
    .from("portal_students")
    .select("display_name")
    .eq("id", studentId)
    .maybeSingle();

  const invoiceId = generateInvoiceId();

  // Record a pending payment first so the webhook/capture can reconcile by invoice_id.
  const { data: payment, error: insertError } = await supabaseAdmin
    .from("fee_payments")
    .insert({
      student_id: studentId,
      amount_cents: amountCents,
      method: "paypal",
      status: "pending",
      category: String(body.category || "marching_band_2026"),
      invoice_id: invoiceId,
      recorded_by: "family_online"
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: "Could not start payment." }, { status: 500 });
  }

  try {
    const order = await createOrder({
      amountCents,
      studentId,
      invoiceId,
      description: `Ashley Bands fee — ${student?.display_name || "student"}`
    });

    await supabaseAdmin
      .from("fee_payments")
      .update({ paypal_order_id: order.id })
      .eq("id", payment.id);

    return NextResponse.json({ orderId: order.id });
  } catch (error) {
    await supabaseAdmin
      .from("fee_payments")
      .update({ status: "failed", notes: String(error.message || "create order failed").slice(0, 500) })
      .eq("id", payment.id);
    return NextResponse.json({ error: "Could not start PayPal payment." }, { status: 502 });
  }
}
