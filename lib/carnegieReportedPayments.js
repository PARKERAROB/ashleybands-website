import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateInvoiceId } from "@/lib/billing";
import { sendCarnegieReportedPaymentEmail } from "@/lib/portalEmail";
import { CARNEGIE_TRIP_CATEGORY } from "@/lib/carnegieTripAccountMath.mjs";
import { CARNEGIE_ADULT_CATEGORY } from "@/lib/carnegieAdults";

// A family reports a Carnegie check or cash they handed in (#237). It is a pending fee_payments
// row: counted nowhere until staff mark it completed (deposited), which sends the final receipt.
export const REPORTED_BY_PREFIX = "family:";
const PURPOSES = {
  [CARNEGIE_TRIP_CATEGORY]: "Carnegie Hall trip",
  [CARNEGIE_ADULT_CATEGORY]: "Carnegie Hall adult travel",
};

function usd(cents) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function validateReportedPayment(input) {
  const category = String(input.category || "");
  const method = String(input.method || "");
  const amountCents = Math.round(Number(input.amountCents) || 0);
  const handedInOn = String(input.handedInOn || "");
  const checkNumber = String(input.checkNumber || "").trim().slice(0, 30);
  if (!PURPOSES[category]) return { error: "Choose what the payment is for." };
  if (!["check", "cash"].includes(method)) return { error: "Choose check or cash." };
  if (amountCents <= 0 || amountCents > 1_000_000) return { error: "Enter the amount." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(handedInOn)) return { error: "Enter the date you handed it in." };
  if (method === "check" && !checkNumber) return { error: "Enter the check number." };
  return { category, method, amountCents, handedInOn, checkNumber };
}

export async function createReportedPayment({ session, studentId, fields }) {
  const reference = generateInvoiceId();
  const { data, error } = await supabaseAdmin.from("fee_payments").insert({
    student_id: studentId,
    amount_cents: fields.amountCents,
    method: fields.method,
    status: "pending",
    category: fields.category,
    kind: "fee",
    invoice_id: reference,
    check_number: fields.method === "check" ? fields.checkNumber : "",
    recorded_by: `${REPORTED_BY_PREFIX}${session.personId}`,
    notes: `Family reported in the portal: ${fields.method}, handed in ${fields.handedInOn}. Not yet deposited.`,
  }).select("id").single();
  if (error) throw new Error(error.message);

  const { data: student } = await supabaseAdmin.from("portal_students").select("display_name").eq("id", studentId).maybeSingle();
  try {
    await sendCarnegieReportedPaymentEmail({
      to: session.email,
      studentName: student?.display_name || "your student",
      amount: usd(fields.amountCents),
      method: fields.method,
      checkNumber: fields.checkNumber,
      handedInOn: fields.handedInOn,
      purpose: PURPOSES[fields.category],
      reference,
    });
  } catch (mailError) {
    console.error("[carnegie-reported-payment] note email failed:", mailError?.message);
  }
  return { id: data.id, reference };
}

// After staff mark a family-reported payment completed: the final receipt (best effort).
export async function sendDepositedReceipt(paymentId) {
  const { data: payment } = await supabaseAdmin.from("fee_payments")
    .select("id,student_id,amount_cents,method,check_number,category,invoice_id,recorded_by,status")
    .eq("id", paymentId).maybeSingle();
  if (!payment || payment.status !== "completed" || !PURPOSES[payment.category]) return;
  if (!String(payment.recorded_by || "").startsWith(REPORTED_BY_PREFIX)) return;
  const personId = payment.recorded_by.slice(REPORTED_BY_PREFIX.length);
  const [{ data: contact }, { data: student }] = await Promise.all([
    supabaseAdmin.from("portal_contact_methods").select("value_display")
      .eq("person_id", personId).eq("contact_type", "email")
      .not("verification_status", "in", "(superseded,replaced,hard_bounce)").limit(1).maybeSingle(),
    supabaseAdmin.from("portal_students").select("display_name").eq("id", payment.student_id).maybeSingle(),
  ]);
  if (!contact?.value_display) return;
  await sendCarnegieReportedPaymentEmail({
    to: contact.value_display,
    studentName: student?.display_name || "your student",
    amount: usd(Number(payment.amount_cents) || 0),
    method: payment.method,
    checkNumber: payment.check_number,
    purpose: PURPOSES[payment.category],
    reference: payment.invoice_id,
    deposited: true,
  });
}
