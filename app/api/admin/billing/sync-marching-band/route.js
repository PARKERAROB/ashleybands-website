import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import {
  MARCHING_BAND_2026_FEE_CENTS,
  MARCHING_BAND_2026_CATEGORY,
  MARCHING_BAND_2026_LABEL
} from "@/lib/marchingBandSignups";

export const runtime = "nodejs";

// POST: assign the $500 MB season fee to every signup-matched student that does
// not already have an active marching_band_2026 charge. Idempotent + re-runnable.
export async function POST(req) {
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.BILLING_WRITE, { scope: { type: "global" } });
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status, headers: { "Cache-Control": "private, no-store" } });
  const staff = authorization.staff;

  const { data: memberships, error: membershipError } = await supabaseAdmin
    .from("program_memberships")
    .select("student_id,program_groups!inner(code,status,ends_on),portal_students!inner(status)")
    .in("program_groups.code", ["marching-band-2026", "color-guard-2026"])
    .eq("program_groups.status", "active")
    .is("program_groups.ends_on", null)
    .eq("portal_students.status", "active")
    .is("ends_on", null);
  if (membershipError) {
    return NextResponse.json({ error: "Could not load current marching records." }, { status: 500 });
  }

  const studentIds = [...new Set((memberships || []).map((membership) => membership.student_id))];
  if (!studentIds.length) {
    return NextResponse.json({ inserted: 0, skipped: 0, unmatchedSignups: 0 });
  }

  // Skip students who already have an active MB charge.
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("fee_charges")
    .select("student_id")
    .in("student_id", studentIds)
    .eq("category", MARCHING_BAND_2026_CATEGORY)
    .eq("status", "active");
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  const already = new Set((existing || []).map((r) => r.student_id));
  const targets = studentIds.filter((id) => !already.has(id));

  if (!targets.length) {
    return NextResponse.json({ inserted: 0, skipped: studentIds.length, unmatchedSignups: 0 });
  }

  const { data, error } = await supabaseAdmin.rpc("create_fee_charges_with_audit", {
    p_student_ids: targets,
    p_category: MARCHING_BAND_2026_CATEGORY,
    p_label: MARCHING_BAND_2026_LABEL,
    p_amount_cents: MARCHING_BAND_2026_FEE_CENTS,
    p_source: "bulk",
    p_kind: "funding_goal",
    p_created_by: staff.display_name,
    p_notes: "",
    p_actor_staff_id: staff.id,
    p_route: "/api/admin/billing/sync-marching-band",
  });
  if (error) return NextResponse.json({ error: "Could not apply the campaign goal." }, { status: 500 });

  return NextResponse.json({
    inserted: Number(data) || 0,
    skipped: studentIds.length - targets.length,
    unmatchedSignups: 0
  });
}
