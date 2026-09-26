import { getSupabaseEnv } from "@/lib/supabaseEnv";
import { supabaseHeaders } from "@/lib/supabaseRest";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

/**
 * POST /api/confirm
 * Records one-click band planning responses into Supabase.
 * Body: { s: student_id, a: action, n?: student_name, p?: parent_name, e?: responder_email, note?: response_note }
 */
const VALID_ACTIONS = new Set(["out", "talk", "band_only", "mb_info"]);

// Families only ever see this. The specific reason is logged on the server.
const FAMILY_ERROR =
  "We couldn't record your answer from this link. Just reply to Mr. Parker's email with your choice and he'll take care of it.";

function familyError(reason, status) {
  console.error("[confirm]", reason);
  return Response.json({ error: FAMILY_ERROR }, { status });
}

// The `s` value must resolve to a real roster student (by source_student_id or
// school_email, exact match case-insensitive) before we accept a write from an
// anonymous sender. Fails CLOSED (unlike the rate limiter): an unmatched id is
// rejected, since this is what stops spam/poisoned rows from reaching the admin
// dashboard. Two separate .eq() calls (via ilike-free exact match) rather than
// a single interpolated .or() filter string, so a comma/wildcard in the
// attacker-controlled studentId can't reshape the query.
async function isKnownStudent(studentId) {
  const normalized = studentId.trim().toLowerCase();
  if (!normalized) return false;
  // Escape ilike wildcards so a studentId of e.g. "%" can't match every row.
  const escaped = normalized.replace(/[%_]/g, (c) => `\\${c}`);

  const [byId, byEmail] = await Promise.all([
    supabaseAdmin.from("portal_students").select("id").eq("source_student_id", studentId).limit(1).maybeSingle(),
    supabaseAdmin.from("portal_students").select("id").ilike("school_email", escaped).limit(1).maybeSingle()
  ]);

  return Boolean(byId.data) || Boolean(byEmail.data);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const studentId = (body.s || "").toString().slice(0, 200);
    const action = (body.a || "").toString();
    const studentName = (body.n || "").toString().slice(0, 200);
    const parentName = (body.p || "").toString().slice(0, 200);
    const responderEmail = (body.e || body.responder_email || "").toString().trim().slice(0, 200);
    const responseNote = (body.note || body.response_note || "").toString().trim().slice(0, 500);

    if (!studentId) {
      return familyError("missing student id", 400);
    }
    if (!VALID_ACTIONS.has(action)) {
      return familyError("invalid action", 400);
    }
    if (responderEmail && !responderEmail.includes("@")) {
      return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for") || "";
    const { allowed } = await checkRateLimit({
      key: `confirm:${clientIp(request)}`,
      limit: 10,
      windowMs: 10 * 60 * 1000
    });
    if (!allowed) {
      return Response.json({ error: "Too many submissions. Please try again in a little while." }, { status: 429 });
    }

    if (!(await isKnownStudent(studentId))) {
      return familyError("unknown student id", 400);
    }

    const { url: supabaseUrl, key: supabaseKey } = getSupabaseEnv();
    if (!supabaseUrl || !supabaseKey) {
      return familyError("Supabase not configured", 500);
    }

    const ua = request.headers.get("user-agent") || "";

    const res = await fetch(`${supabaseUrl}/rest/v1/band_recapture_2026`, {
      method: "POST",
      headers: supabaseHeaders(supabaseKey, {
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      }),
      body: JSON.stringify({
        student_id: studentId,
        student_name: studentName,
        parent_name: parentName,
        responder_email: responderEmail,
        response_note: responseNote,
        action,
        user_agent: ua.slice(0, 500),
        ip: ip.slice(0, 100)
      })
    });

    if (!res.ok) {
      const detail = await res.text();
      return familyError(`db error: ${detail}`, 500);
    }

    return Response.json({ ok: true });
  } catch (error) {
    return familyError(error?.message || error, 500);
  }
}

export function GET() {
  return Response.json({ error: "Method Not Allowed" }, { status: 405 });
}
