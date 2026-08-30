import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAudit, staffActor } from "@/lib/auditLog";
import { chargeKindForCategory, loadStudentLedgers } from "@/lib/billing";

export const runtime = "nodejs";

function sum(rows, field) {
  return (rows || []).reduce((total, row) => total + (Number(row[field]) || 0), 0);
}

// Staff-only marching roster joined to the existing funding ledger. The roster
// owns who is marching; the ledger owns goals and money received.
export async function GET(request) {
  const authorization = await authorizeStaffRequest(request, STAFF_CAPABILITIES.FUNDING_READ, { scope: { type: "global" } });
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status, headers: { "Cache-Control": "private, no-store" } });
  const staff = authorization.staff;

  const { data: memberships, error } = await supabaseAdmin
    .from("program_memberships")
    .select(
      "student_id,membership_role,program_groups!inner(code,status,ends_on),portal_students!inner(id,display_name,legal_first,legal_last,preferred_first,grade_fall26,instrument_2026,mb_role_2026,status)"
    )
    .in("program_groups.code", ["marching-band-2026", "color-guard-2026"])
    .eq("program_groups.status", "active")
    .is("program_groups.ends_on", null)
    .eq("portal_students.status", "active")
    .is("ends_on", null);

  if (error) return NextResponse.json({ error: "Could not load campaign funding." }, { status: 500 });
  const studentsById = new Map();
  for (const membership of memberships || []) {
    const student = Array.isArray(membership.portal_students) ? membership.portal_students[0] : membership.portal_students;
    if (!student) continue;
    const existing = studentsById.get(student.id);
    studentsById.set(student.id, { ...student, membershipRole: existing?.membershipRole || membership.membership_role || "" });
  }
  const students = [...studentsById.values()].sort((left, right) =>
    String(left.legal_last || "").localeCompare(String(right.legal_last || ""))
    || String(left.legal_first || "").localeCompare(String(right.legal_first || "")));

  const studentIds = (students || []).map((student) => student.id);
  const [{ charges, payments }, { data: giftRows, error: giftError }] = await Promise.all([
    loadStudentLedgers(studentIds),
    studentIds.length ? supabaseAdmin.from("sponsor_gifts")
      .select("portal_student_id,amount_cents")
      .in("portal_student_id", studentIds)
      .eq("status", "confirmed") : Promise.resolve({ data: [], error: null }),
  ]);
  if (giftError) return NextResponse.json({ error: "Could not load campaign funding." }, { status: 500 });
  const giftsByStudent = (giftRows || []).reduce((result, gift) => {
    result[gift.portal_student_id] = (result[gift.portal_student_id] || 0) + (Number(gift.amount_cents) || 0);
    return result;
  }, {});

  const roster = (students || []).map((student) => {
    const fundingCharges = (charges[student.id] || []).filter(
      (charge) => charge.status === "active" && (charge.kind === "funding_goal" || chargeKindForCategory(charge.category) === "funding_goal")
    );
    const fundingPayments = (payments[student.id] || []).filter(
      (payment) => payment.status === "completed" && (payment.kind === "funding_goal" || (!payment.kind && chargeKindForCategory(payment.category) === "funding_goal"))
    );
    const goalCents = sum(fundingCharges, "amount_cents");
    const familyContributionCents = sum(fundingPayments.filter((payment) => !payment.is_sponsorship), "amount_cents");
    const legacySponsorshipCreditCents = sum(fundingPayments.filter((payment) => payment.is_sponsorship), "amount_cents");
    const sponsorshipCents = giftsByStudent[student.id] || 0;
    const raisedCents = familyContributionCents + sponsorshipCents;

    return {
      id: student.id,
      displayName: student.display_name,
      legalFirst: student.legal_first || "",
      legalLast: student.legal_last || "",
      preferredFirst: student.preferred_first || "",
      grade: student.grade_fall26 || "",
      instrument: student.instrument_2026 || student.mb_role_2026 || "",
      role: student.membershipRole || student.mb_role_2026 || "",
      goalCents,
      raisedCents,
      sponsorshipCents,
      familyContributionCents,
      legacySponsorshipCreditCents,
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
    recordId: "marching-band-2026,color-guard-2026",
    route: "/api/admin/marching-band/funding"
  });

  return NextResponse.json({ roster, totals }, { headers: { "Cache-Control": "private, no-store" } });
}
