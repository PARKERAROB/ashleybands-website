import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateStaffRequest } from "@/lib/staffAuth";

export const runtime = "nodejs";

function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

// GET /api/admin/billing/export -> CSV of every payment (financial record).
export async function GET(req) {
  const staff = await validateStaffRequest(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: payments, error } = await supabaseAdmin
    .from("fee_payments")
    .select(
      "id, student_id, amount_cents, method, status, category, invoice_id, recorded_by, received_at, created_at, notes, portal_students(display_name)"
    )
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const header = [
    "student",
    "amount_usd",
    "method",
    "status",
    "category",
    "invoice_id",
    "recorded_by",
    "received_at",
    "created_at",
    "notes"
  ];

  const rows = (payments || []).map((p) =>
    [
      p.portal_students?.display_name || p.student_id,
      ((Number(p.amount_cents) || 0) / 100).toFixed(2),
      p.method,
      p.status,
      p.category,
      p.invoice_id,
      p.recorded_by,
      p.received_at || "",
      p.created_at,
      p.notes || ""
    ]
      .map(csvCell)
      .join(",")
  );

  const csv = [header.join(","), ...rows].join("\n");
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ashley-bands-payments-${stamp}.csv"`
    }
  });
}
