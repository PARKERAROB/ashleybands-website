import { getSupabaseEnv } from "@/lib/supabaseEnv";
import { supabaseHeaders } from "@/lib/supabaseRest";

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

export async function POST(request) {
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

    return Response.json(data);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export function GET() {
  return Response.json({ error: "Method Not Allowed" }, { status: 405 });
}
