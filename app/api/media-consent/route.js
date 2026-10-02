import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import {
  ANSWERS,
  MEDIA_CONSENT_FAMILY_ERROR as FAMILY_ERROR,
  PREVIEW_TOKEN,
  isAutomatedAgent,
  studentFirstName,
  verifyMediaConsentToken,
} from "@/lib/mediaConsent.mjs";

export const runtime = "nodejs";

/**
 * POST /api/media-consent  { t: signed student token, a: "yes" | "no" }
 * Records a guardian's media interview answer (#162). The token is an HMAC over
 * the portal student id, so a link can only ever record for its own student.
 * t = "preview" returns success without touching the database.
 */
function familyError(reason, status) {
  console.error("[media-consent]", reason);
  return Response.json({ error: FAMILY_ERROR }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.t || "").slice(0, 200);
    const answer = String(body.a || "");
    if (!ANSWERS.has(answer)) return familyError("invalid answer", 400);

    if (token === PREVIEW_TOKEN) {
      return Response.json({ ok: true, preview: true, firstName: "Sample", answer });
    }

    const studentId = verifyMediaConsentToken(token);
    if (!studentId) return familyError("invalid token", 400);

    const userAgent = request.headers.get("user-agent") || "";
    if (isAutomatedAgent(userAgent)) return familyError("automated agent", 400);

    const { allowed } = await checkRateLimit({
      key: `media-consent:${clientIp(request)}`,
      limit: 30,
      windowMs: 10 * 60 * 1000,
    });
    if (!allowed) {
      return Response.json({ error: "Too many answers from here. Please try again in a little while." }, { status: 429 });
    }

    const { data: student, error: lookupError } = await supabaseAdmin
      .from("portal_students")
      .select("id, preferred_first, legal_first, display_name, status")
      .eq("id", studentId)
      .maybeSingle();
    if (lookupError) return familyError(`lookup: ${lookupError.message}`, 500);
    if (!student || student.status !== "active") return familyError("student not active", 400);

    const { error: insertError } = await supabaseAdmin
      .from("media_consent_responses")
      .insert({ student_id: student.id, answer, source: "email_link", user_agent: userAgent.slice(0, 500) });
    if (insertError) return familyError(`insert: ${insertError.message}`, 500);

    return Response.json({ ok: true, firstName: studentFirstName(student), answer }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return familyError(error?.message || error, 500);
  }
}

export function GET() {
  return Response.json({ error: "Method Not Allowed" }, { status: 405 });
}
