import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";

export const runtime = "nodejs";

const MAX_CHARGE_CENTS = 1_000_000;

// POST: assign a charge to one or many students.
// body: { studentIds: [...], category, label, amountCents, notes?, skipExistingCategory? }
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const studentIds = [...new Set((body.studentIds || []).map((id) => String(id)).filter(Boolean))];
  const amountCents = Math.round(Number(body.amountCents) || 0);
  const category = String(body.category || "").trim();
  const kind = body.kind === "funding_goal" ? "funding_goal" : body.kind === "fee" ? "fee" : "";
  const label = String(body.label || "").slice(0, 200);
  const notes = String(body.notes || "").slice(0, 500);

  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.BILLING_WRITE, {
    scopes: studentIds.map((ref) => ({ type: "student", ref })),
  });
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status, headers: { "Cache-Control": "private, no-store" } });
  const staff = authorization.staff;

  if (!studentIds.length) {
    return NextResponse.json({ error: "Select at least one student" }, { status: 400 });
  }
  if (!category) return NextResponse.json({ error: "Choose a fee or campaign category." }, { status: 400 });
  if (!kind) return NextResponse.json({ error: "Choose whether this is a program fee or campaign goal." }, { status: 400 });
  if (!Number.isFinite(amountCents) || amountCents <= 0 || amountCents > MAX_CHARGE_CENTS) {
    return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });
  }

  let targets = studentIds;

  // Avoid double-assigning the same fee category when seeding in bulk.
  if (body.skipExistingCategory) {
    const { data: existing } = await supabaseAdmin
      .from("fee_charges")
      .select("student_id")
      .in("student_id", studentIds)
      .eq("category", category)
      .eq("status", "active");
    const already = new Set((existing || []).map((r) => r.student_id));
    targets = studentIds.filter((id) => !already.has(id));
  }

  if (!targets.length) {
    return NextResponse.json({ inserted: 0, skipped: studentIds.length });
  }

  const source = targets.length > 1 ? "bulk" : "manual";
  const { data, error } = await supabaseAdmin.rpc("create_fee_charges_with_audit", {
    p_student_ids: targets,
    p_category: category,
    p_label: label,
    p_amount_cents: amountCents,
    p_source: source,
    p_kind: kind,
    p_created_by: staff.display_name,
    p_notes: notes,
    p_actor_staff_id: staff.id,
    p_route: "/api/admin/billing/charges",
  });
  if (error) return NextResponse.json({ error: "Could not create the charge." }, { status: 500 });
  return NextResponse.json({ inserted: Number(data) || 0, skipped: studentIds.length - targets.length });
}

// PATCH: void a charge. body: { id }
export async function PATCH(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const capabilityAuthorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.BILLING_WRITE, {
    safeCapabilityOnly: true,
  });
  if (!capabilityAuthorization.ok) return NextResponse.json({ error: capabilityAuthorization.error }, { status: capabilityAuthorization.status, headers: { "Cache-Control": "private, no-store" } });

  const { data: charge } = await supabaseAdmin.from("fee_charges").select("student_id").eq("id", id).maybeSingle();
  if (!charge) return NextResponse.json({ error: "Charge not found" }, { status: 404 });
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.BILLING_WRITE, {
    scope: { type: "student", ref: charge.student_id },
  });
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status, headers: { "Cache-Control": "private, no-store" } });
  const staff = authorization.staff;

  const { error } = await supabaseAdmin.rpc("update_fee_charge_with_audit", {
    p_charge_id: id,
    p_status: "void",
    p_notes: body.notes == null ? null : String(body.notes).slice(0, 500),
    p_actor_staff_id: staff.id,
    p_route: "/api/admin/billing/charges",
  });

  if (error) return NextResponse.json({ error: "Could not void the charge." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
