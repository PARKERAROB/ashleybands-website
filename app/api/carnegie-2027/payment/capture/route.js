import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { amountToCents, captureOrder, centsToAmount, extractCapture } from "@/lib/paypal";
import { readCarnegieCheckoutToken } from "@/lib/carnegieTrip";
import { CARNEGIE_DEPOSIT_CATEGORY, CARNEGIE_DEPOSIT_CENTS } from "@/lib/carnegieTripConstants";
import { sendFeePaymentReceiptEmail } from "@/lib/portalEmail";

export const runtime = "nodejs";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const token = readCarnegieCheckoutToken(body.checkoutToken);
  const orderId = String(body.orderId || "");
  if (!token || !orderId) return NextResponse.json({ error: "This payment session is invalid or expired." }, { status: 401 });
  const { data: payment, error: paymentError } = await supabaseAdmin.from("fee_payments")
    .select("id,student_id,amount_cents,status,invoice_id,category,kind,paypal_order_id")
    .eq("paypal_order_id", orderId).maybeSingle();
  if (paymentError || !payment || payment.student_id !== token.studentId || payment.category !== CARNEGIE_DEPOSIT_CATEGORY) {
    return NextResponse.json({ error: "The connected payment was not found." }, { status: 404 });
  }
  if (payment.status === "completed") return NextResponse.json({ status: "completed", invoiceId: payment.invoice_id });
  if (payment.status !== "pending") return NextResponse.json({ error: "This payment session is no longer active." }, { status: 409 });
  const [{ data: latestSubmission }, { data: activeCharge }] = await Promise.all([
    supabaseAdmin.from("carnegie_trip_submissions").select("id,response").eq("student_id", payment.student_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from("fee_charges").select("id,amount_cents").eq("student_id", payment.student_id).eq("category", CARNEGIE_DEPOSIT_CATEGORY).eq("status", "active").maybeSingle(),
  ]);
  if (latestSubmission?.response !== "serious_yes" || !activeCharge || Number(activeCharge.amount_cents) !== CARNEGIE_DEPOSIT_CENTS) {
    return NextResponse.json({ error: "The latest family response no longer has an active conditional deposit." }, { status: 409 });
  }

  let detail;
  try {
    detail = extractCapture(await captureOrder(orderId));
  } catch {
    return NextResponse.json({ error: "PayPal could not complete the payment." }, { status: 502 });
  }
  if (
    detail.captureStatus !== "COMPLETED"
    || payment.kind !== "fee"
    || detail.invoiceId !== payment.invoice_id
    || detail.customId !== payment.student_id
    || amountToCents(detail.amountValue) !== CARNEGIE_DEPOSIT_CENTS
    || Number(payment.amount_cents) !== CARNEGIE_DEPOSIT_CENTS
    || detail.currencyCode !== "USD"
  ) return NextResponse.json({ error: "The completed payment did not match the conditional deposit." }, { status: 409 });

  const { error: settleError } = await supabaseAdmin.rpc("settle_online_fee_payment_with_audit", {
    p_payment_id: payment.id,
    p_capture_id: detail.captureId,
    p_actor_type: "parent",
    p_actor_id: token.submissionId,
    p_actor_name: token.email || "Carnegie family form",
    p_route: "/api/carnegie-2027/payment/capture",
  });
  if (settleError) return NextResponse.json({ error: "The payment was captured but needs staff reconciliation." }, { status: 503 });

  try {
    const { data: student } = await supabaseAdmin.from("portal_students").select("display_name").eq("id", payment.student_id).maybeSingle();
    if (token.email) await sendFeePaymentReceiptEmail({
      to: token.email,
      studentName: student?.display_name || "your student",
      amount: `$${centsToAmount(CARNEGIE_DEPOSIT_CENTS)}`,
      method: "PayPal / card",
      invoiceId: payment.invoice_id,
      purpose: "Carnegie Hall conditional deposit",
    });
  } catch {
    // A receipt failure never reverses a completed payment.
  }
  return NextResponse.json({ status: "completed", invoiceId: payment.invoice_id });
}
