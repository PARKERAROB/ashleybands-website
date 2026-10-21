import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { privateJson } from "@/lib/privateResponse";
import { logAudit } from "@/lib/auditLog";
import { captureOrder, createOrder, extractCapture } from "@/lib/paypal";
import { INVOICE_ID_PREFIX, buildInvoice, onlineSurchargeCents } from "@/lib/allCountyMeals.mjs";
import { PAYMENTS, captureMatchesPayment, directorView, findByToken, onlinePaidCents, onlinePaymentAvailable, settlePayment } from "@/lib/allCountyMealsServer";

export const runtime = "nodejs";

// Optional online payment of an All-County meals invoice (#221). The director's edit link is the
// only key. "start" creates a PayPal order for what is still owed plus the surcharge; "capture"
// completes it after the director approves in PayPal's window. The webhook settles the same row
// if this response is lost, and settlement is idempotent.

const DECLINED = "Your payment didn't go through, and you have not been charged. Try another card, or pay by check or cash.";
const UNCONFIRMED = "We couldn't confirm this payment. Please don't pay again. Email Mr. Parker at robert.parker@nhcs.net and he'll check it.";
const PENDING = "PayPal is still processing this payment. Please don't pay again. It will show here once it clears.";
const ROUTE = "/api/all-county/meals/pay";

export async function POST(request) {
  if (!onlinePaymentAvailable()) return privateJson({ error: "Online payment isn't available right now. Please pay by check or cash." }, 503);
  const body = await request.json().catch(() => null);
  const action = body?.action === "start" || body?.action === "capture" ? body.action : null;
  if (!action) return privateJson({ error: "Invalid request." }, 400);
  const limit = await checkRateLimit({ key: `allcounty-meals:pay-${action}:${clientIp(request)}`, limit: 15, windowMs: 15 * 60 * 1000, failOpen: false });
  if (!limit.allowed) return privateJson({ error: "Too many payment attempts. Please try again later." }, 429);

  const row = await findByToken(body.token).catch(() => null);
  if (!row) return privateJson({ error: "That edit link is not valid. Ask for a new one on the order page." }, 404);
  return action === "start" ? start(row) : capture(row, body);
}

async function start(row) {
  try {
    const due = buildInvoice(row.students, row.price_cents).totalCents - await onlinePaidCents(row.id);
    if (due <= 0) return privateJson({ error: "Nothing is owed on this invoice." }, 409);
    const surcharge = onlineSurchargeCents(due);
    const invoiceId = `${INVOICE_ID_PREFIX}${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
    const { data: payment, error } = await supabaseAdmin.from(PAYMENTS)
      .insert({ signup_id: row.id, invoice_id: invoiceId, meal_cents: due, surcharge_cents: surcharge })
      .select("id,invoice_id").single();
    if (error) throw error;
    try {
      const order = await createOrder({
        amountCents: due + surcharge,
        studentId: payment.id, // PayPal custom_id: our payment id, for reconciliation
        invoiceId: payment.invoice_id,
        description: `All-County meals - ${row.school}`.slice(0, 127),
        requestId: payment.id,
      });
      const { error: updateError } = await supabaseAdmin.from(PAYMENTS).update({ paypal_order_id: order.id }).eq("id", payment.id);
      if (updateError) throw updateError;
      return privateJson({ orderId: order.id });
    } catch (orderError) {
      await supabaseAdmin.from(PAYMENTS).delete().eq("id", payment.id).eq("status", "pending");
      throw orderError;
    }
  } catch (error) {
    console.error("[allcounty-meals] pay start failed:", error?.message || error);
    return privateJson({ error: "Could not start the PayPal payment. Please try again, or pay by check or cash." }, 502);
  }
}

async function capture(row, body) {
  const orderId = String(body.orderId || "").trim();
  if (!/^[A-Z0-9-]{8,64}$/i.test(orderId)) return privateJson({ error: "Missing or invalid order." }, 400);
  const { data: payment, error } = await supabaseAdmin.from(PAYMENTS)
    .select("id,signup_id,invoice_id,meal_cents,surcharge_cents,status")
    .eq("paypal_order_id", orderId).eq("signup_id", row.id).maybeSingle();
  if (error || !payment) return privateJson({ error: UNCONFIRMED }, 404);

  if (payment.status !== "completed") {
    let detail;
    try {
      detail = extractCapture(await captureOrder(orderId));
    } catch (captureError) {
      const text = String(captureError?.message || captureError);
      console.error("[allcounty-meals] capture failed", { paymentId: payment.id, error: text });
      const declined = /^PayPal capture failed \(4\d\d\)/.test(text) && !/ORDER_ALREADY_CAPTURED/.test(text);
      return privateJson({ error: declined ? DECLINED : UNCONFIRMED }, 502);
    }
    if (detail.captureStatus === "PENDING") return privateJson({ error: PENDING }, 402);
    if (!captureMatchesPayment(detail, payment)) {
      console.error("[allcounty-meals] capture mismatch", { paymentId: payment.id, captureId: detail.captureId, status: detail.captureStatus });
      return privateJson({ error: detail.captureStatus === "COMPLETED" ? UNCONFIRMED : DECLINED }, 409);
    }
    if (await settlePayment(payment, detail.captureId)) {
      await logAudit({ actor: { type: "system", name: "PayPal capture" }, action: "allcounty_meals.online_payment", table: PAYMENTS, recordId: payment.id, changes: { meal_cents: payment.meal_cents, surcharge_cents: payment.surcharge_cents }, route: ROUTE });
    }
  }
  return privateJson({ ok: true, ...directorView(row, await onlinePaidCents(row.id)) });
}
