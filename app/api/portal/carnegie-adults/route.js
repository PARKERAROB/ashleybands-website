import { privateJson } from "@/lib/privateResponse";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readPortalSession } from "@/lib/portalTokens";
import { isTrustedGuardian } from "@/lib/billing";
import { logAudit } from "@/lib/auditLog";
import {
  CARNEGIE_ADULT_CUTOFF,
  CARNEGIE_ADULT_TERMS_VERSION,
  carnegieAdultPriceCents,
  loadCarnegieAdultAccounts,
  validateCarnegieAdult,
} from "@/lib/carnegieAdults";

export const runtime = "nodejs";

// A family adds an adult coming to New York (#237). Rob alone marks official chaperones,
// so the family can only ask (chaperone_interest). No one is added after the cutoff.
export async function POST(request) {
  const session = readPortalSession(request);
  if (!session?.personId) return privateJson({ error: "Sign in first." }, 401);
  const body = await request.json().catch(() => ({}));
  const studentId = String(body.studentId || "");
  if (!studentId || !await isTrustedGuardian(session.personId, studentId)) {
    return privateJson({ error: "A verified parent or guardian must add adults for this student." }, 403);
  }
  if (new Date() > new Date(`${CARNEGIE_ADULT_CUTOFF}T23:59:59-05:00`)) {
    return privateJson({ error: "Adult sign-up for Carnegie Hall is closed. Contact Mr. Parker." }, 409);
  }
  const fields = validateCarnegieAdult(body);
  if (fields.error) return privateJson({ error: fields.error }, 400);

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin.from("carnegie_adult_travelers").insert({
    student_id: studentId,
    submitted_by_person_id: session.personId,
    adult_name: fields.adultName,
    travel_option: fields.travelOption,
    room_type: fields.roomType,
    roommates: fields.roommates,
    chaperone_interest: fields.chaperoneInterest,
    price_cents: carnegieAdultPriceCents(fields.travelOption, fields.roomType),
    terms_version: fields.termsAccepted ? CARNEGIE_ADULT_TERMS_VERSION : null,
    terms_accepted_at: fields.termsAccepted ? now : null,
    source: "portal",
  }).select("id").single();
  if (error) {
    console.error("[carnegie-adults] insert failed:", error.message);
    return privateJson({ error: "The adult could not be saved. Please try again." }, 500);
  }
  await logAudit({
    actor: { type: "parent", id: session.personId, name: session.email },
    action: "add_carnegie_adult",
    table: "carnegie_adult_travelers",
    recordId: data.id,
    changes: { student_id: studentId, travel_option: fields.travelOption, room_type: fields.roomType, chaperone_interest: fields.chaperoneInterest },
    route: "/api/portal/carnegie-adults",
  });
  const accounts = await loadCarnegieAdultAccounts([studentId]);
  return privateJson({ ok: true, account: accounts?.[studentId] || null });
}
