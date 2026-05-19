import { getSupabaseEnv } from "@/lib/supabaseEnv";
import { supabaseHeaders } from "@/lib/supabaseRest";

export async function POST(request) {
  try {
    const body = await request.json();
    const code = String(body.code || "").trim().toUpperCase();
    const name = String(body.display_name || "").trim().slice(0, 40);
    if (!code || !name) return Response.json({ error: "code and name required" }, { status: 400 });

    const instrument = String(body.instrument || "").trim().slice(0, 40) || null;
    const period = String(body.period || "").trim().slice(0, 10) || null;

    const { url, key } = getSupabaseEnv();
    if (!url || !key) return Response.json({ error: "Supabase not configured" }, { status: 500 });

    const res = await fetch(`${url}/rest/v1/rpc/staff_sprint_join`, {
      method: "POST",
      headers: supabaseHeaders(key, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        p_code: code,
        p_display_name: name,
        p_instrument: instrument,
        p_period: period
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return Response.json({ error: data.message || "join failed" }, { status: 500 });

    const row = Array.isArray(data) ? data[0] : data;
    return Response.json({
      player_id: row.out_player_id ?? row.player_id,
      race_id: row.out_race_id ?? row.race_id,
      session_id: row.out_session_id ?? row.session_id
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
