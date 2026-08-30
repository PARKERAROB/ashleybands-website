import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { loadStudentLedgers } from "@/lib/billing";
import { loadFinancialOperations } from "@/lib/financialOperations";
import { logAudit, staffActor } from "@/lib/auditLog";

export const runtime = "nodejs";

// GET /api/admin/billing            -> roster of all students with balances
// GET /api/admin/billing?studentId= -> full ledger for one student
export async function GET(req) {
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.BILLING_READ);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status, headers: { "Cache-Control": "private, no-store" } });

  const url = new URL(req.url);
  const studentId = url.searchParams.get("studentId");

  if (studentId) {
    const { data: student } = await supabaseAdmin
      .from("portal_students")
      .select("id, display_name, grade_fall26, status")
      .eq("id", studentId)
      .eq("status", "active")
      .maybeSingle();
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    const { charges, payments, balances } = await loadStudentLedgers([studentId]);
    const feeCharges = (charges[studentId] || []).filter((row) => row.kind === "fee");
    const feePayments = (payments[studentId] || []).filter((row) => row.kind === "fee" && !row.is_sponsorship);
    await logAudit({ actor: staffActor(authorization.staff), action: "view", table: "fee_charges,fee_payments", recordId: studentId, route: "/api/admin/billing" });
    return NextResponse.json({
      student,
      balance: balances[studentId] || { charged_cents: 0, paid_cents: 0, balance_cents: 0 },
      charges: feeCharges,
      payments: feePayments
    }, { headers: { "Cache-Control": "private, no-store" } });
  }

  let operations;
  try {
    operations = await loadFinancialOperations();
  } catch {
    return NextResponse.json({ error: "Could not load billing records." }, { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }

  const roster = operations.roster.map((s) => {
    return {
      id: s.id,
      name: s.displayName,
      legalFirst: s.legalFirst,
      legalLast: s.legalLast,
      preferredFirst: s.preferredFirst,
      grade: s.grade,
      status: s.status,
      marchingBand: s.groups.some((group) => ["Marching Band", "Color Guard"].includes(group.name)),
      chargedCents: s.fee.chargedCents,
      paidCents: s.fee.paidCents,
      sponsorshipCents: 0,
      cashPaidCents: s.fee.paidCents,
      balanceCents: s.fee.balanceCents,
    };
  });

  await logAudit({ actor: staffActor(authorization.staff), action: "view", table: "fee_charges,fee_payments", recordId: "active-students", route: "/api/admin/billing" });
  return NextResponse.json({ roster, marchingBandUnmatched: 0 }, { headers: { "Cache-Control": "private, no-store" } });
}
