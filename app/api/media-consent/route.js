import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import {
  ANSWERS,
  MEDIA_CONSENT_FAMILY_ERROR as FAMILY_ERROR,
  PREVIEW_TOKEN,
  isAutomatedAgent,
  lookupOrRecordConsent,
  verifyMediaConsentToken,
} from "@/lib/mediaConsent.mjs";

export const runtime = "nodejs";

/**
 * GET  /api/media-consent?t=token          -> { firstName }  Read-only. The confirm page
 *      calls this on load to name the student. It never records (#177).
 * POST /api/media-consent  { t, a: "yes" | "no" } Records a guardian's media interview
 *      answer (#162). Sent only when a person presses a button on the confirm page.
 * The token is an HMAC over the portal student id, so a link only ever reaches its own
 * student. t = "preview" returns success without touching the database.
 */
const NO_STORE = { "Cache-Control": "no-store" };

function familyError(reason, status) {
  console.error("[media-consent]", reason);
  return Response.json({ error: FAMILY_ERROR }, { status, headers: NO_STORE });
}

async function rateLimited(request, kind) {
  const { allowed } = await checkRateLimit({
    key: `media-consent${kind}:${clientIp(request)}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  return allowed
    ? null
    : Response.json({ error: "Too many answers from here. Please try again in a little while." }, { status: 429, headers: NO_STORE });
}

export async function GET(request) {
  try {
    const token = String(new URL(request.url).searchParams.get("t") || "").slice(0, 200);
    if (token === PREVIEW_TOKEN) return Response.json({ ok: true, preview: true, firstName: "Sample" }, { headers: NO_STORE });

    const studentId = verifyMediaConsentToken(token);
    if (!studentId) return familyError("invalid token", 400);

    const limited = await rateLimited(request, "-view");
    if (limited) return limited;

    const result = await lookupOrRecordConsent(supabaseAdmin, studentId);
    if (result.error) return familyError(result.error, result.status);
    return Response.json({ ok: true, firstName: result.firstName }, { headers: NO_STORE });
  } catch (error) {
    return familyError(error?.message || error, 500);
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.t || "").slice(0, 200);
    const answer = String(body.a || "");
    if (!ANSWERS.has(answer)) return familyError("invalid answer", 400);

    if (token === PREVIEW_TOKEN) {
      return Response.json({ ok: true, preview: true, firstName: "Sample", answer }, { headers: NO_STORE });
    }

    const studentId = verifyMediaConsentToken(token);
    if (!studentId) return familyError("invalid token", 400);

    const userAgent = request.headers.get("user-agent") || "";
    if (isAutomatedAgent(userAgent)) return familyError("automated agent", 400);

    const limited = await rateLimited(request, "");
    if (limited) return limited;

    const result = await lookupOrRecordConsent(supabaseAdmin, studentId, { answer, userAgent });
    if (result.error) return familyError(result.error, result.status);
    return Response.json({ ok: true, firstName: result.firstName, answer }, { headers: NO_STORE });
  } catch (error) {
    return familyError(error?.message || error, 500);
  }
}
