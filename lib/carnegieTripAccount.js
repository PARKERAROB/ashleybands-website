import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CARNEGIE_DEPOSIT_CATEGORY, CARNEGIE_TRIP_CATEGORY, carnegieTripAccount } from "@/lib/carnegieTripAccountMath.mjs";

export function shapeReported(row) {
  return {
    id: row.id,
    amountCents: Number(row.amount_cents) || 0,
    method: row.method,
    checkNumber: row.check_number || "",
    reportedAt: row.created_at,
  };
}

// Loads the Carnegie trip account for roster students (#237). Returns { [studentId]: account },
// or null when the records can't be read. Students not on the Carnegie roster get no account.
export async function loadCarnegieTripAccounts(studentIds) {
  if (!studentIds.length) return {};
  const [roster, gifts, payments, reported] = await Promise.all([
    supabaseAdmin.from("carnegie_trip_staff_tracking").select("student_id")
      .in("student_id", studentIds).eq("carnegie_roster", true),
    supabaseAdmin.from("sponsor_gifts")
      .select("id,portal_student_id,invoice_id,business_name,amount_cents,paypal_fee_cents,method,gift_kind,received_at,confirmed_at,share_with_family")
      .in("portal_student_id", studentIds).eq("campaign_code", "carnegie-2027").eq("status", "confirmed"),
    supabaseAdmin.from("fee_payments")
      .select("id,student_id,amount_cents,paypal_fee_cents,method,category,received_at,created_at")
      .in("student_id", studentIds).in("category", [CARNEGIE_DEPOSIT_CATEGORY, CARNEGIE_TRIP_CATEGORY])
      .eq("kind", "fee").eq("status", "completed"),
    supabaseAdmin.from("fee_payments")
      .select("id,student_id,amount_cents,method,check_number,created_at")
      .in("student_id", studentIds).eq("category", CARNEGIE_TRIP_CATEGORY)
      .eq("status", "pending").like("recorded_by", "family:%"),
  ]);
  if (roster.error || gifts.error || payments.error || reported.error) return null;

  const accounts = {};
  for (const { student_id: studentId } of roster.data || []) {
    const studentGifts = (gifts.data || []).filter((gift) => gift.portal_student_id === studentId);
    const asPayment = (gift) => ({
      id: gift.id,
      amountCents: (Number(gift.amount_cents) || 0) - (Number(gift.paypal_fee_cents) || 0),
      grossCents: Number(gift.amount_cents) || 0,
      paypalFeeCents: gift.paypal_fee_cents == null ? null : Number(gift.paypal_fee_cents),
      method: gift.method === "online" ? "paypal" : gift.method,
      label: "Family payment",
      receivedAt: gift.received_at || gift.confirmed_at,
    });
    accounts[studentId] = {
      ...carnegieTripAccount({
      gifts: studentGifts.filter((gift) => gift.gift_kind !== "family_payment").map((gift) => ({
        id: gift.id,
        invoiceId: gift.invoice_id,
        from: gift.share_with_family === false ? "A supporter" : gift.business_name || "A supporter",
        amountCents: Number(gift.amount_cents) || 0,
        paypalFeeCents: gift.paypal_fee_cents == null ? null : Number(gift.paypal_fee_cents),
        online: gift.method === "online",
        method: gift.method,
        receivedAt: gift.received_at || gift.confirmed_at,
      })),
      familyPayments: [
        ...studentGifts.filter((gift) => gift.gift_kind === "family_payment").map(asPayment),
        ...(payments.data || []).filter((payment) => payment.student_id === studentId).map((payment) => ({
          id: payment.id,
          // Online payments count what reached the Boosters, after PayPal's fee (Rob, 2026-10-27).
          amountCents: (Number(payment.amount_cents) || 0) - (Number(payment.paypal_fee_cents) || 0),
          grossCents: Number(payment.amount_cents) || 0,
          paypalFeeCents: payment.paypal_fee_cents == null ? null : Number(payment.paypal_fee_cents),
          method: payment.method,
          label: payment.category === CARNEGIE_DEPOSIT_CATEGORY ? "Deposit" : "Family payment",
          receivedAt: payment.received_at || payment.created_at,
        })),
      ].sort((a, b) => String(a.receivedAt).localeCompare(String(b.receivedAt))),
      }),
      // Checks and cash the family reported; not credited until deposited.
      reported: (reported.data || []).filter((row) => row.student_id === studentId).map(shapeReported),
    };
  }
  return accounts;
}

// What a family may still pay toward the trip share, for the payment routes' cap.
export async function carnegieTripRemainingCents(studentId) {
  const accounts = await loadCarnegieTripAccounts([studentId]);
  if (!accounts) return null;
  return accounts[studentId]?.owedCents ?? 0;
}
