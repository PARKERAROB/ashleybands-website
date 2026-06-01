import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateStaffRequest } from "@/lib/staffAuth";
import { loadStudentLedgers } from "@/lib/billing";
import { loadMatchedSignups } from "@/lib/marchingBandSignups";

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

  // Roster: all students left-joined to the balance view, plus marching-band
  // signup flag and sponsorship-credit totals.
  const [{ data: students, error }, { data: balanceRows }, { data: sponsorRows }, matchResult] =
    await Promise.all([
      supabaseAdmin
        .from("portal_students")
        .select("id, display_name, legal_first, legal_last, preferred_first, grade_fall26, status")
        .order("display_name", { ascending: true }),
      supabaseAdmin
        .from("student_fee_balances")
        .select("student_id, charged_cents, paid_cents, balance_cents"),
      supabaseAdmin
        .from("fee_payments")
        .select("student_id, amount_cents")
        .eq("is_sponsorship", true)
        .eq("status", "completed"),
      loadMatchedSignups().catch(() => ({ matches: [], unmatchedCount: 0 }))
    ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byStudent = (balanceRows || []).reduce((acc, r) => {
    acc[r.student_id] = r;
    return acc;
  }, {});

  const sponsorByStudent = (sponsorRows || []).reduce((acc, r) => {
    acc[r.student_id] = (acc[r.student_id] || 0) + (Number(r.amount_cents) || 0);
    return acc;
  }, {});

  const mbStudentIds = new Set((matchResult?.matches || []).map((m) => m.studentId));

  const roster = (students || []).map((s) => {
    const bal = byStudent[s.id] || { charged_cents: 0, paid_cents: 0, balance_cents: 0 };
    const sponsorshipCents = sponsorByStudent[s.id] || 0;
    const paidCents = Number(bal.paid_cents) || 0;
    return {
      id: s.id,
      name: s.display_name,
      legalFirst: s.legal_first || "",
      legalLast: s.legal_last || "",
      preferredFirst: s.preferred_first || "",
      grade: s.grade_fall26 || "",
      status: s.status || "",
      marchingBand: mbStudentIds.has(s.id),
      chargedCents: Number(bal.charged_cents) || 0,
      paidCents,
      sponsorshipCents,
      cashPaidCents: Math.max(paidCents - sponsorshipCents, 0),
      balanceCents: Number(bal.balance_cents) || 0
    };
  });

  return NextResponse.json({ roster, marchingBandUnmatched: matchResult?.unmatchedCount || 0 });
}
