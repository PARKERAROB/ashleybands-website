import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { chargeKindForCategory } from "@/lib/billing";

function number(value) {
  return Number(value) || 0;
}

function isCampaign(category, kind = "") {
  return kind === "funding_goal" || (!kind && chargeKindForCategory(category) === "funding_goal");
}

function group(rows, key = "student_id") {
  return (rows || []).reduce((result, row) => {
    (result[row[key]] ||= []).push(row);
    return result;
  }, {});
}

function sum(rows) {
  return (rows || []).reduce((total, row) => total + number(row.amount_cents), 0);
}

function one(row, key) {
  return Array.isArray(row?.[key]) ? row[key][0] || null : row?.[key] || null;
}

export async function loadFinancialOperations({ studentIds: requestedStudentIds = null } = {}) {
  let studentQuery = supabaseAdmin
    .from("portal_students")
    .select("id,display_name,legal_first,legal_last,preferred_first,grade_fall26,status,updated_at")
    .eq("status", "active")
    .order("legal_last", { ascending: true })
    .order("legal_first", { ascending: true });
  if (Array.isArray(requestedStudentIds)) studentQuery = requestedStudentIds.length ? studentQuery.in("id", requestedStudentIds) : studentQuery.eq("id", "00000000-0000-0000-0000-000000000000");
  const { data: students, error: studentError } = await studentQuery.limit(500);
  if (studentError) throw new Error("Could not load current financial records.");

  const studentIds = (students || []).map((student) => student.id);
  if (!studentIds.length) return { roster: [], categories: [], updatedAt: null };

  const [chargesResult, paymentsResult, giftsResult, membershipsResult] = await Promise.all([
    supabaseAdmin.from("fee_charges")
      .select("id,student_id,category,label,amount_cents,status,kind,source,created_at,updated_at")
      .in("student_id", studentIds)
      .order("created_at", { ascending: true }),
    supabaseAdmin.from("fee_payments")
      .select("id,student_id,amount_cents,method,status,category,kind,received_at,is_sponsorship,created_at")
      .in("student_id", studentIds)
      .order("created_at", { ascending: true }),
    supabaseAdmin.from("sponsor_gifts")
      .select("id,portal_student_id,amount_cents,status,received_at,updated_at")
      .in("portal_student_id", studentIds)
      .eq("status", "confirmed"),
    supabaseAdmin.from("program_memberships")
      .select("student_id,program_groups(id,name,status,ends_on)")
      .in("student_id", studentIds)
      .is("ends_on", null),
  ]);
  for (const result of [chargesResult, paymentsResult, giftsResult, membershipsResult]) {
    if (result.error) throw new Error("Could not load current financial records.");
  }

  const chargesByStudent = group(chargesResult.data);
  const paymentsByStudent = group(paymentsResult.data);
  const giftsByStudent = group(giftsResult.data, "portal_student_id");
  const membershipsByStudent = group(membershipsResult.data);
  const categories = new Map();

  const roster = (students || []).map((student) => {
    const allCharges = chargesByStudent[student.id] || [];
    const allPayments = paymentsByStudent[student.id] || [];
    const feeCharges = allCharges.filter((row) => row.status === "active" && !isCampaign(row.category, row.kind));
    const feePayments = allPayments.filter((row) => row.status === "completed" && !row.is_sponsorship && !isCampaign(row.category, row.kind));
    const campaignCharges = allCharges.filter((row) => row.status === "active" && isCampaign(row.category, row.kind));
    const campaignContributions = allPayments.filter((row) => row.status === "completed" && !row.is_sponsorship && isCampaign(row.category, row.kind));
    const legacySponsorshipCredits = allPayments.filter((row) => row.status === "completed" && row.is_sponsorship && isCampaign(row.category, row.kind));
    const confirmedGifts = giftsByStudent[student.id] || [];
    const feeChargedCents = sum(feeCharges);
    const feePaidCents = sum(feePayments);
    const campaignGoalCents = sum(campaignCharges);
    const campaignContributionCents = sum(campaignContributions);
    const confirmedGiftCents = sum(confirmedGifts);
    const legacySponsorshipCreditCents = sum(legacySponsorshipCredits);
    const campaignRaisedCents = campaignContributionCents + confirmedGiftCents;

    for (const charge of allCharges) {
      if (!charge.category || charge.status !== "active") continue;
      categories.set(charge.category, {
        id: charge.category,
        label: charge.label || charge.category,
        kind: isCampaign(charge.category, charge.kind) ? "funding_goal" : "fee",
      });
    }

    const groups = (membershipsByStudent[student.id] || [])
      .map((membership) => one(membership, "program_groups"))
      .filter((programGroup) => programGroup?.status === "active" && !programGroup.ends_on)
      .map((programGroup) => ({ id: programGroup.id, name: programGroup.name }))
      .sort((left, right) => left.name.localeCompare(right.name));

    return {
      id: student.id,
      displayName: student.display_name,
      legalFirst: student.legal_first || "",
      legalLast: student.legal_last || "",
      preferredFirst: student.preferred_first || "",
      grade: student.grade_fall26 || "",
      status: student.status,
      groups,
      fee: {
        chargedCents: feeChargedCents,
        paidCents: feePaidCents,
        balanceCents: feeChargedCents - feePaidCents,
        charges: feeCharges,
        payments: feePayments,
      },
      campaign: {
        goalCents: campaignGoalCents,
        familyContributionCents: campaignContributionCents,
        confirmedGiftCents,
        legacySponsorshipCreditCents,
        raisedCents: campaignRaisedCents,
        remainingCents: Math.max(campaignGoalCents - campaignRaisedCents, 0),
        goalMet: campaignGoalCents > 0 && campaignRaisedCents >= campaignGoalCents,
        charges: campaignCharges,
        contributions: campaignContributions,
        confirmedGifts: confirmedGifts.map((gift) => ({
          id: gift.id,
          amount_cents: gift.amount_cents,
          status: gift.status,
          received_at: gift.received_at,
          updated_at: gift.updated_at,
        })),
      },
      updatedAt: [
        student.updated_at,
        ...allCharges.map((row) => row.updated_at || row.created_at),
        ...allPayments.map((row) => row.received_at || row.created_at),
        ...confirmedGifts.map((row) => row.updated_at || row.received_at),
      ].filter(Boolean).sort().at(-1) || null,
    };
  });

  return {
    roster,
    categories: [...categories.values()],
    updatedAt: roster.map((student) => student.updatedAt).filter(Boolean).sort().at(-1) || null,
  };
}
