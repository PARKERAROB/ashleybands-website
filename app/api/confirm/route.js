import { getSupabaseEnv } from "@/lib/supabaseEnv";
import { supabaseHeaders } from "@/lib/supabaseRest";

/**
 * POST /api/confirm
 * Records a Lane 3 recapture-email response into Supabase.
 * Body: { s: student_id, a: 'out' | 'talk', n?: student_name, p?: parent_name }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const studentId = (body.s || "").toString().slice(0, 200);
    const action = (body.a || "").toString();
    const studentName = (body.n || "").toString().slice(0, 200);
    const parentName = (body.p || "").toString().slice(0, 200);

    if (!studentId) {
      return Response.json({ error: "missing student id" }, { status: 400 });
    }
    if (action !== "out" && action !== "talk") {
      return Response.json({ error: "invalid action" }, { status: 400 });
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
