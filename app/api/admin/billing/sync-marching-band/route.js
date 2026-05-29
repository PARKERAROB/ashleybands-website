import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateStaffRequest } from "@/lib/staffAuth";
import {
  loadMatchedSignups,
  MARCHING_BAND_2026_FEE_CENTS,
  MARCHING_BAND_2026_CATEGORY,
  MARCHING_BAND_2026_LABEL
} from "@/lib/marchingBandSignups";

export const runtime = "nodejs";

// POST: assign the $500 MB season fee to every signup-matched student that does
// not already have an active marching_band_2026 charge. Idempotent + re-runnable.
export async function POST(req) {
  const staff = await validateStaffRequest(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let matches, unmatchedSignups;
  try {
    ({ matches, unmatchedCount: unmatchedSignups } = await loadMatchedSignups());
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const studentIds = matches.map((m) => m.studentId);
  if (!studentIds.length) {
    return NextResponse.json({ inserted: 0, skipped: 0, unmatchedSignups });
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
    return NextResponse.json({ inserted: 0, skipped: studentIds.length, unmatchedSignups });
  }

  const rows = targets.map((student_id) => ({
    student_id,
    category: MARCHING_BAND_2026_CATEGORY,
    label: MARCHING_BAND_2026_LABEL,
    amount_cents: MARCHING_BAND_2026_FEE_CENTS,
    source: "signup",
    created_by: staff.display_name
  }));

  const { data, error } = await supabaseAdmin.from("fee_charges").insert(rows).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    inserted: data?.length || 0,
    skipped: studentIds.length - targets.length,
    unmatchedSignups
  });
}
