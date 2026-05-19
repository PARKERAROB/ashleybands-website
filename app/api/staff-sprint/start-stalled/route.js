import { getSupabaseEnv } from "@/lib/supabaseEnv";
import { supabaseHeaders } from "@/lib/supabaseRest";

export async function POST(request) {
  try {
    const body = await request.json();
    const sessionId = String(body.session_id || "");
    if (!sessionId) return Response.json({ error: "session_id required" }, { status: 400 });

    const { url, key } = getSupabaseEnv();
    if (!url || !key) return Response.json({ error: "Supabase not configured" }, { status: 500 });

    const res = await fetch(`${url}/rest/v1/rpc/staff_sprint_start_stalled`, {
      method: "POST",
      headers: supabaseHeaders(key, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        p_session_id: sessionId,
        p_min_players: Number(body.min_players) || 2,
        p_grace_seconds: Number(body.grace_seconds) || 20
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return Response.json({ error: data.message || "start-stalled failed" }, { status: 500 });

    return Response.json({ started: data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
