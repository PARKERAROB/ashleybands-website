import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveSponsorFamily, sponsorFunnelLive } from "@/lib/sponsorFamily";
import { signSponsorGiveToken } from "@/lib/sponsorGiveToken.mjs";
import {
  ensureSponsorStudentLinks,
  loadAuthorizedSponsorStudents
} from "@/lib/sponsorStudentLinks";

export const runtime = "nodejs";

// First-paint aggregate for the portal-native family sponsorship dashboard (build-spec §4).
// Everything the family screen needs in one call: their businesses (with claim countdowns),
// how many warmed leads are available to claim, and their dollars toward the $2,000 goal.

export const FAMILY_GOAL_CENTS = 200000; // $2,000 aspirational per-family goal (NEVER a fee)
export const TARGET_BUSINESS_COUNT = 5;

export async function GET(req) {
  if (!sponsorFunnelLive()) {
    return NextResponse.json({ error: "Sponsorship area is not open yet." }, { status: 404 });
  }
  const resolved = await resolveSponsorFamily(req);
  if (!resolved?.family) {
    return NextResponse.json({ error: "Sign in to the Family Portal to open sponsorship." }, { status: 401 });
  }
  const fam = resolved.family;
  let students;
  let studentLinks;
  try {
    students = await loadAuthorizedSponsorStudents(fam);
    studentLinks = await ensureSponsorStudentLinks(students);
  } catch (error) {
    return NextResponse.json({ error: String(error?.message || error) }, { status: 500 });
  }
  const studentIds = students.map((student) => student.id);

  const [{ data: prospects, error: pErr }, { count: warmedCount }, familyGiftResult, studentGiftResult] = await Promise.all([
    supabaseAdmin
      .from("prospects")
      .select(
        "id, status, contact_name, contact_email, contact_phone, business_address, relationship_note, contact_mode, lead_kind, contacted_at, dropped_off_at, committed_amount, committed_tier, sent_to_lead, created_at, business:businesses(id, name_display, category, distance_mi, claimed_at, reclaim_at, claim_contacted_at)"
      )
      .eq("family_id", fam.id)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("provenance", "system-sourced")
      .eq("outreach_status", "willing")
      .is("claimed_by_family_id", null),
    supabaseAdmin
      .from("sponsor_gifts")
      .select("id, portal_student_id, amount_cents")
      .eq("family_id", fam.id)
      .eq("status", "confirmed"),
    studentIds.length
      ? supabaseAdmin
          .from("sponsor_gifts")
          .select("id, portal_student_id, amount_cents")
          .in("portal_student_id", studentIds)
          .eq("status", "confirmed")
      : Promise.resolve({ data: [], error: null })
  ]);

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (familyGiftResult.error) return NextResponse.json({ error: familyGiftResult.error.message }, { status: 500 });
  if (studentGiftResult.error) return NextResponse.json({ error: studentGiftResult.error.message }, { status: 500 });

  const linkedProspects = (prospects || []).map((prospect) => {
    const businessId = prospect.business?.id;
    if (!businessId) return prospect;
    const token = signSponsorGiveToken({ businessId, prospectId: prospect.id });
    return { ...prospect, give_path: `/sponsors/give?a=${encodeURIComponent(token)}` };
  });

  const allConfirmed = new Map();
  for (const gift of [...(familyGiftResult.data || []), ...(studentGiftResult.data || [])]) {
    allConfirmed.set(gift.id, gift);
  }
  const studentTotals = new Map(studentIds.map((id) => [id, { confirmedCents: 0, confirmedGifts: 0 }]));
  for (const gift of studentGiftResult.data || []) {
    const total = studentTotals.get(gift.portal_student_id);
    if (!total) continue;
    total.confirmedCents += Number(gift.amount_cents || 0);
    total.confirmedGifts += 1;
  }
  const directLinks = studentLinks.map(({ student, link }) => ({
    student: {
      id: student.id,
      display_name: student.portal_name,
      first_name: student.public_name
    },
    give_path: `/support/${link.code}`,
    confirmedCents: studentTotals.get(student.id)?.confirmedCents || 0,
    confirmedGifts: studentTotals.get(student.id)?.confirmedGifts || 0
  }));

  return NextResponse.json({
    family: { id: fam.id, display_name: fam.display_name, actor: resolved.actor },
    directGiveLinks: directLinks,
    prospects: linkedProspects,
    warmedAvailable: warmedCount || 0,
    confirmedCents: [...allConfirmed.values()].reduce((sum, gift) => sum + Number(gift.amount_cents || 0), 0),
    confirmedGifts: allConfirmed.size,
    goalCents: FAMILY_GOAL_CENTS,
    targetBusinessCount: TARGET_BUSINESS_COUNT
  });
}
