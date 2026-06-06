import { getSupabaseEnv } from "@/lib/supabaseEnv";
import { supabaseHeaders } from "@/lib/supabaseRest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  findStudentIdForSignup,
  MARCHING_BAND_2026_FEE_CENTS,
  MARCHING_BAND_2026_CATEGORY,
  MARCHING_BAND_2026_LABEL
} from "@/lib/marchingBandSignups";

const REQUIRED_TEXT = [
  "student_first_name",
  "student_last_name",
  "grade_fall",
  "instrument",
  "guardian_name",
  "guardian_email",
  "guardian_phone",
  "funding_path",
  "student_signature",
  "parent_signature"
];

const REQUIRED_CHECKS = [
  "calendar_acknowledgment",
  "financial_acknowledgment",
  "volunteer_acknowledgment",
  "student_acknowledgment",
  "parent_acknowledgment",
  "travel_permission",
  "emergency_care_permission"
];

// 2026 marching band Signing Day closed 2026-06-06 (see BDOS archives/2026-06-06-signing-day-close).
// REOPENED 2026-06-06 for late/edge entrants (Charlie Bradshaw + stragglers). Re-close when done.
const SIGNUP_CLOSED = false;

export async function POST(request) {
  if (SIGNUP_CLOSED) {
    return Response.json({ error: "Marching band sign-up for the 2026 season is closed." }, { status: 403 });
  }
  try {
    const payload = await request.json();
    const missingText = REQUIRED_TEXT.filter((field) => !String(payload[field] || "").trim());
    const missingChecks = REQUIRED_CHECKS.filter((field) => payload[field] !== true);

    if (missingText.length || missingChecks.length) {
      return Response.json({
        error: "missing required fields",
        missingText,
        missingChecks
      }, { status: 400 });
    }

    const guardianEmail = String(payload.guardian_email || "").trim();
    if (!guardianEmail.includes("@")) {
      return Response.json({ error: "invalid guardian email" }, { status: 400 });
    }

    const { url: supabaseUrl, key: supabaseKey } = getSupabaseEnv();
    if (!supabaseUrl || !supabaseKey) {
      return Response.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/submit_mb_signup_2026`, {
      method: "POST",
      headers: supabaseHeaders(supabaseKey, {
        "Content-Type": "application/json"
      }),
      body: JSON.stringify({ payload })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return Response.json({ error: data.message || data.error || "Signup failed" }, { status: 500 });
    }

    // Best-effort: auto-add the $500 season fee to the matched student's billing
    // account. Never fail the signup if this errors.
    await maybeAutoChargeMarchingBand(payload);

    return Response.json(data);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function maybeAutoChargeMarchingBand(payload) {
  try {
    const { data: students, error } = await supabaseAdmin
      .from("portal_students")
      .select("id, source_student_id, legal_first, legal_last, preferred_first, display_name, school_email");
    if (error || !students) return;

    const studentId = findStudentIdForSignup(students, {
      sourceStudentId: payload.source_student_id,
      studentEmail: payload.student_email,
      firstName: payload.student_first_name,
      lastName: payload.student_last_name
    });
    if (!studentId) return;

    // Idempotent: skip if this student already has an active MB charge.
    const { data: existing } = await supabaseAdmin
      .from("fee_charges")
      .select("id")
      .eq("student_id", studentId)
      .eq("category", MARCHING_BAND_2026_CATEGORY)
      .eq("status", "active")
      .limit(1);
    if (existing && existing.length) return;

    await supabaseAdmin.from("fee_charges").insert({
      student_id: studentId,
      category: MARCHING_BAND_2026_CATEGORY,
      label: MARCHING_BAND_2026_LABEL,
      amount_cents: MARCHING_BAND_2026_FEE_CENTS,
      source: "signup",
      kind: "funding_goal",
      created_by: "mb_signup_form"
    });
  } catch (err) {
    console.error("[marching-band-signup] auto-charge failed:", err?.message || err);
  }
}

export function GET() {
  return Response.json({ error: "Method Not Allowed" }, { status: 405 });
}
