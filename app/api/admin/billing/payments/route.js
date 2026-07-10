import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateStaffRequest } from "@/lib/staffAuth";
import { generateInvoiceId } from "@/lib/billing";
import { logAudit, staffActor } from "@/lib/auditLog";

export const runtime = "nodejs";

const OFFLINE_METHODS = ["check", "cash", "credit", "sponsorship", "adjustment"];
const MAX_PAYMENT_CENTS = 1_000_000;

// POST: record an offline payment / credit against a student.
// body: { studentId, amountCents, method, category?, receivedAt?, notes? }
export async function POST(req) {
  const staff = await validateStaffRequest(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const studentId = String(body.studentId || "");
  const amountCents = Math.round(Number(body.amountCents) || 0);
  const method = String(body.method || "");

  if (!studentId) return NextResponse.json({ error: "Missing student" }, { status: 400 });
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

  const { data, error } = await supabaseAdmin
    .from("fee_payments")
    .insert({
      student_id: studentId,
      amount_cents: amountCents,
      method,
      status: "completed",
      category: String(body.category || "marching_band_2026"),
      invoice_id: generateInvoiceId(),
      recorded_by: staff.display_name,
      received_at: receivedAt.toISOString(),
      payer_name: String(body.payerName || "").slice(0, 200),
      check_number: method === "check" ? String(body.checkNumber || "").slice(0, 50) : "",
      is_sponsorship: !!body.isSponsorship,
      notes: String(body.notes || "").slice(0, 500)
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actor: staffActor(staff),
    action: "insert",
    table: "fee_payments",
    recordId: data.id,
    route: "/api/admin/billing/payments",
    changes: {
      student_id: { old: null, new: studentId },
      amount_cents: { old: null, new: amountCents },
      method: { old: null, new: method },
      is_sponsorship: { old: null, new: !!body.isSponsorship }
    }
  });

  return NextResponse.json({ id: data.id });
}

// PATCH: change a payment's status (e.g. mark refunded). body: { id, status, notes? }
export async function PATCH(req) {
  const staff = await validateStaffRequest(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

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

  const update = { status };
  if (body.notes != null) update.notes = String(body.notes).slice(0, 500);

  const { data: current } = await supabaseAdmin
    .from("fee_payments")
    .select("status, notes")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabaseAdmin.from("fee_payments").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actor: staffActor(staff),
    action: "update",
    table: "fee_payments",
    recordId: id,
    route: "/api/admin/billing/payments",
    changes: { status: { old: current?.status ?? null, new: status } }
  });

  return NextResponse.json({ ok: true });
}
