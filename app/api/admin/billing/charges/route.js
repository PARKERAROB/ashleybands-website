import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateStaffRequest } from "@/lib/staffAuth";
import { chargeKindForCategory } from "@/lib/billing";
import { logAudit, staffActor } from "@/lib/auditLog";

export const runtime = "nodejs";

const MAX_CHARGE_CENTS = 1_000_000;

// POST: assign a charge to one or many students.
// body: { studentIds: [...], category, label, amountCents, notes?, skipExistingCategory? }
export async function POST(req) {
  const staff = await validateStaffRequest(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const studentIds = [...new Set((body.studentIds || []).map((id) => String(id)).filter(Boolean))];
  const amountCents = Math.round(Number(body.amountCents) || 0);
  const category = String(body.category || "marching_band_2026");
  const label = String(body.label || "").slice(0, 200);
  const notes = String(body.notes || "").slice(0, 500);

  if (!studentIds.length) {
    return NextResponse.json({ error: "Select at least one student" }, { status: 400 });
  }
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
  const kind = chargeKindForCategory(category);
  const rows = targets.map((student_id) => ({
    student_id,
    category,
    label,
    amount_cents: amountCents,
    source,
    kind,
    created_by: staff.display_name,
    notes
  }));

  const { data, error } = await supabaseAdmin.from("fee_charges").insert(rows).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actor: staffActor(staff),
    action: "insert",
    table: "fee_charges",
    recordId: targets.join(","),
    route: "/api/admin/billing/charges",
    changes: {
      student_ids: { old: null, new: targets },
      category: { old: null, new: category },
      amount_cents: { old: null, new: amountCents }
    }
  });

  return NextResponse.json({ inserted: data?.length || 0, skipped: studentIds.length - targets.length });
}

// PATCH: void a charge. body: { id }
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
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { data: current } = await supabaseAdmin
    .from("fee_charges")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabaseAdmin
    .from("fee_charges")
    .update({ status: "void", notes: String(body.notes || "").slice(0, 500) || undefined })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actor: staffActor(staff),
    action: "update",
    table: "fee_charges",
    recordId: id,
    route: "/api/admin/billing/charges",
    changes: { status: { old: current?.status ?? null, new: "void" } }
  });

  return NextResponse.json({ ok: true });
}
