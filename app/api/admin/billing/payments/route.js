import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { generateInvoiceId } from "@/lib/billing";

export const runtime = "nodejs";

const OFFLINE_METHODS = ["check", "cash", "credit", "adjustment"];
const MAX_PAYMENT_CENTS = 1_000_000;

// POST: record an offline payment / credit against a student.
// body: { studentId, amountCents, method, category?, receivedAt?, notes? }
export async function POST(req) {
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.BILLING_WRITE);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status, headers: { "Cache-Control": "private, no-store" } });
  const staff = authorization.staff;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const studentId = String(body.studentId || "");
  const amountCents = Math.round(Number(body.amountCents) || 0);
  const method = String(body.method || "");
  const category = String(body.category || "").trim();

  if (!studentId) return NextResponse.json({ error: "Missing student" }, { status: 400 });
  if (!category) return NextResponse.json({ error: "Choose the fee or campaign category this payment belongs to." }, { status: 400 });
  if (!OFFLINE_METHODS.includes(method)) {
    return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
  }
  if (!Number.isFinite(amountCents) || amountCents <= 0 || amountCents > MAX_PAYMENT_CENTS) {
    return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });
  }

  const receivedAt = body.receivedAt ? new Date(body.receivedAt) : new Date();
  if (Number.isNaN(receivedAt.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const { data: matchingCharges, error: chargeError } = await supabaseAdmin
    .from("fee_charges")
    .select("kind")
    .eq("student_id", studentId)
    .eq("category", category)
    .eq("status", "active");
  if (chargeError || !matchingCharges?.length) {
    return NextResponse.json({ error: "That student does not have an active fee or campaign goal in this category." }, { status: 409 });
  }
  const kinds = [...new Set(matchingCharges.map((charge) => charge.kind))];
  if (kinds.length !== 1) return NextResponse.json({ error: "That financial category needs review before a payment can be recorded." }, { status: 409 });

  const { data, error } = await supabaseAdmin.rpc("record_fee_payment_with_audit", {
    p_student_id: studentId,
    p_amount_cents: amountCents,
    p_method: method,
    p_category: category,
    p_kind: kinds[0],
    p_invoice_id: generateInvoiceId(),
    p_recorded_by: staff.display_name,
    p_received_at: receivedAt.toISOString(),
    p_payer_name: String(body.payerName || "").slice(0, 200),
    p_check_number: method === "check" ? String(body.checkNumber || "").slice(0, 50) : "",
    p_notes: String(body.notes || "").slice(0, 500),
    p_actor_staff_id: staff.id,
    p_route: "/api/admin/billing/payments",
  });

  if (error) return NextResponse.json({ error: "Could not record the payment." }, { status: 500 });

  return NextResponse.json({ id: data });
}

// PATCH: change a payment's status (e.g. mark refunded). body: { id, status, notes? }
export async function PATCH(req) {
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.BILLING_WRITE);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status, headers: { "Cache-Control": "private, no-store" } });
  const staff = authorization.staff;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const id = String(body.id || "");
  const status = String(body.status || "");
  if (!id || !["completed", "refunded", "failed"].includes(status)) {
    return NextResponse.json({ error: "Valid id and status required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.rpc("update_fee_payment_with_audit", {
    p_payment_id: id,
    p_status: status,
    p_notes: body.notes == null ? null : String(body.notes).slice(0, 500),
    p_actor_staff_id: staff.id,
    p_route: "/api/admin/billing/payments",
  });
  if (error) return NextResponse.json({ error: "Could not update the payment." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
