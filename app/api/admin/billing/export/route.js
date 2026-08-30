import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAuditRequired, staffActor } from "@/lib/auditLog";

export const runtime = "nodejs";

function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

// GET /api/admin/billing/export -> CSV of every payment (financial record).
export async function GET(req) {
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.BILLING_EXPORT);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status, headers: { "Cache-Control": "private, no-store" } });

  const { data: payments, error } = await supabaseAdmin
    .from("fee_payments")
    .select(
      "id, student_id, amount_cents, method, status, category, invoice_id, recorded_by, received_at, created_at, notes, portal_students(display_name)"
    )
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: "Could not export payments." }, { status: 500, headers: { "Cache-Control": "private, no-store" } });

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
  try {
    await logAuditRequired({ actor: staffActor(authorization.staff), action: "export", table: "fee_payments", recordId: "all-payment-history", route: "/api/admin/billing/export", changes: { row_count: rows.length } });
  } catch {
    return NextResponse.json({ error: "The required export record could not be saved." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ashley-bands-payments-${stamp}.csv"`,
      "Cache-Control": "private, no-store"
    }
  });
}
