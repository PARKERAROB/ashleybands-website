import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateStaffRequest } from "@/lib/staffAuth";
import { loadStudentLedgers } from "@/lib/billing";

export const runtime = "nodejs";

// GET /api/admin/billing            -> roster of all students with balances
// GET /api/admin/billing?studentId= -> full ledger for one student
export async function GET(req) {
  const staff = await validateStaffRequest(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const url = new URL(req.url);
  const studentId = url.searchParams.get("studentId");

  if (studentId) {
    const { data: student } = await supabaseAdmin
      .from("portal_students")
      .select("id, display_name, grade_fall26, status")
      .eq("id", studentId)
      .maybeSingle();
    if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });

    const { charges, payments, balances } = await loadStudentLedgers([studentId]);
    return NextResponse.json({
      student,
      balance: balances[studentId] || { charged_cents: 0, paid_cents: 0, balance_cents: 0 },
      charges: charges[studentId] || [],
      payments: payments[studentId] || []
    });
  }

  // Roster: all students left-joined to the balance view.
  const [{ data: students, error }, { data: balanceRows }] = await Promise.all([
    supabaseAdmin
      .from("portal_students")
      .select("id, display_name, grade_fall26, status")
      .order("display_name", { ascending: true }),
    supabaseAdmin
      .from("student_fee_balances")
      .select("student_id, charged_cents, paid_cents, balance_cents")
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byStudent = (balanceRows || []).reduce((acc, r) => {
    acc[r.student_id] = r;
    return acc;
  }, {});

  const roster = (students || []).map((s) => {
    const bal = byStudent[s.id] || { charged_cents: 0, paid_cents: 0, balance_cents: 0 };
    return {
      id: s.id,
      name: s.display_name,
      grade: s.grade_fall26 || "",
      status: s.status || "",
      chargedCents: Number(bal.charged_cents) || 0,
      paidCents: Number(bal.paid_cents) || 0,
      balanceCents: Number(bal.balance_cents) || 0
    };
  });

  return NextResponse.json({ roster });
}
