import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readPortalSession } from "@/lib/portalTokens";
import { isTrustedGuardian } from "@/lib/billing";
import { amountToCents, captureOrder, extractCapture, centsToAmount } from "@/lib/paypal";
import { sendFeePaymentReceiptEmail } from "@/lib/portalEmail";

export const runtime = "nodejs";

export async function POST(request) {
  const session = readPortalSession(request);
  if (!session?.personId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const orderId = String(body.orderId || "");
  if (!orderId) {
    return NextResponse.json({ error: "Missing order." }, { status: 400 });
  }

  // Find the pending payment we created for this order and confirm ownership.
  const { data: payment } = await supabaseAdmin
    .from("fee_payments")
    .select("id, student_id, amount_cents, status, invoice_id, category, kind")
    .eq("paypal_order_id", orderId)
    .maybeSingle();

  if (!payment) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }
  const allowed = await isTrustedGuardian(session.personId, payment.student_id);
  if (!allowed) {
    return NextResponse.json({ error: "Not authorized for this payment." }, { status: 403 });
  }

  // Already settled (e.g. webhook beat us) — return success idempotently.
  if (payment.status === "completed") {
    return NextResponse.json({ status: "completed", invoiceId: payment.invoice_id });
  }

  let detail;
  try {
    const result = await captureOrder(orderId);
    detail = extractCapture(result);
  } catch (error) {
    return NextResponse.json({ error: "Could not capture payment." }, { status: 502 });
  }

  if (detail.captureStatus !== "COMPLETED" && detail.status !== "COMPLETED") {
    return NextResponse.json({ error: "Payment was not completed." }, { status: 402 });
  }
  if (
    payment.kind !== "fee"
    || detail.invoiceId !== payment.invoice_id
    || detail.customId !== payment.student_id
    || amountToCents(detail.amountValue) !== Number(payment.amount_cents)
    || detail.currencyCode !== "USD"
  ) {
    return NextResponse.json({ error: "The completed payment did not match the expected fee record." }, { status: 409 });
  }

  const { error: settleError } = await supabaseAdmin.rpc("settle_online_fee_payment_with_audit", {
    p_payment_id: payment.id,
    p_capture_id: detail.captureId,
    p_actor_type: "parent",
    p_actor_id: session.personId,
    p_actor_name: session.email || "Family portal",
    p_route: "/api/billing/capture-order",
  });
  if (settleError) {
    return NextResponse.json({ error: "The payment was captured but could not be reconciled automatically." }, { status: 503 });
  }

  // Receipt (best effort — never fail the payment on email error).
  try {
    const { data: student } = await supabaseAdmin
      .from("portal_students")
      .select("display_name")
      .eq("id", payment.student_id)
      .maybeSingle();
    const { data: balance } = await supabaseAdmin
      .from("student_program_fee_summary")
      .select("balance_cents")
      .eq("student_id", payment.student_id)
      .maybeSingle();

    if (session.email) {
      await sendFeePaymentReceiptEmail({
        to: session.email,
        studentName: student?.display_name || "your student",
        amount: `$${centsToAmount(payment.amount_cents)}`,
        method: "PayPal / card",
        invoiceId: payment.invoice_id,
        balance: balance ? `$${centsToAmount(balance.balance_cents)}` : ""
      });
    }
  } catch {
    // ignore receipt failures
  }

  return NextResponse.json({ status: "completed", invoiceId: payment.invoice_id });
}
