import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateStaffRequest } from "@/lib/staffAuth";
import { logAudit, staffActor } from "@/lib/auditLog";
import { chargeKindForCategory, loadStudentLedgers } from "@/lib/billing";

export const runtime = "nodejs";

function sum(rows, field) {
  return (rows || []).reduce((total, row) => total + (Number(row[field]) || 0), 0);
}

// Staff-only marching roster joined to the existing funding ledger. The roster
// owns who is marching; the ledger owns goals and money received.
export async function GET(request) {
  const staff = await validateStaffRequest(request);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: students, error } = await supabaseAdmin
    .from("portal_students")
    .select(
      "id, display_name, legal_first, legal_last, preferred_first, grade_fall26, instrument_2026, mb_role_2026"
    )
    .ilike("marching_2026", "yes")
    .order("legal_last", { ascending: true })
    .order("legal_first", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const studentIds = (students || []).map((student) => student.id);
  const { charges, payments } = await loadStudentLedgers(studentIds);

  const roster = (students || []).map((student) => {
    const fundingCharges = (charges[student.id] || []).filter(
      (charge) => charge.status === "active" && (charge.kind === "funding_goal" || chargeKindForCategory(charge.category) === "funding_goal")
    );
    const fundingPayments = (payments[student.id] || []).filter(
      (payment) => payment.status === "completed" && chargeKindForCategory(payment.category) === "funding_goal"
    );
    const goalCents = sum(fundingCharges, "amount_cents");
    const raisedCents = sum(fundingPayments, "amount_cents");
    const sponsorshipCents = sum(
      fundingPayments.filter((payment) => payment.is_sponsorship),
      "amount_cents"
    );

    return {
      id: student.id,
      displayName: student.display_name,
      legalFirst: student.legal_first || "",
      legalLast: student.legal_last || "",
      preferredFirst: student.preferred_first || "",
      grade: student.grade_fall26 || "",
      instrument: student.instrument_2026 || student.mb_role_2026 || "",
      role: student.mb_role_2026 || "",
      goalCents,
      raisedCents,
      sponsorshipCents,
      remainingCents: Math.max(goalCents - raisedCents, 0),
      progressPercent: goalCents > 0 ? Math.round((raisedCents / goalCents) * 100) : null
    };
  });

  const totals = roster.reduce(
    (summary, student) => ({
      students: summary.students + 1,
      goalCents: summary.goalCents + student.goalCents,
      raisedCents: summary.raisedCents + student.raisedCents,
      sponsorshipCents: summary.sponsorshipCents + student.sponsorshipCents,
      remainingCents: summary.remainingCents + student.remainingCents,
      withoutGoal: summary.withoutGoal + (student.goalCents > 0 ? 0 : 1),
      goalMet: summary.goalMet + (student.goalCents > 0 && student.raisedCents >= student.goalCents ? 1 : 0)
    }),
    {
      students: 0,
      goalCents: 0,
      raisedCents: 0,
      sponsorshipCents: 0,
      remainingCents: 0,
      withoutGoal: 0,
      goalMet: 0
    }
  );

  await logAudit({
    actor: staffActor(staff),
    action: "view",
    table: "portal_students,fee_charges,fee_payments",
    recordId: "marching_2026:yes",
    route: "/api/admin/marching-band/funding"
  });

  return NextResponse.json({ roster, totals });
}
