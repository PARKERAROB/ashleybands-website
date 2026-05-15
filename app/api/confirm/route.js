import { getSupabaseEnv } from "@/lib/supabaseEnv";
import { supabaseHeaders } from "@/lib/supabaseRest";

/**
 * POST /api/confirm
 * Records one-click band planning responses into Supabase.
 * Body: { s: student_id, a: action, n?: student_name, p?: parent_name, e?: responder_email, note?: response_note }
 */
const VALID_ACTIONS = new Set(["out", "talk", "band_only", "mb_info"]);

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
      return Response.json({ error: "missing student id" }, { status: 400 });
    }
    if (!VALID_ACTIONS.has(action)) {
      return Response.json({ error: "invalid action" }, { status: 400 });
    }
    if (responderEmail && !responderEmail.includes("@")) {
      return Response.json({ error: "invalid email" }, { status: 400 });
    }

    const { url: supabaseUrl, key: supabaseKey } = getSupabaseEnv();
    if (!supabaseUrl || !supabaseKey) {
      return Response.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const ua = request.headers.get("user-agent") || "";
    const ip = request.headers.get("x-forwarded-for") || "";

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
      return Response.json({ error: `db error: ${detail}` }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export function GET() {
  return Response.json({ error: "Method Not Allowed" }, { status: 405 });
}
