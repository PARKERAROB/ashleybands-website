import { getSupabaseEnv } from "@/lib/supabaseEnv";
import { supabaseHeaders } from "@/lib/supabaseRest";

export async function POST(request) {
  try {
    const body = await request.json();
    const playerId = String(body.player_id || "");
    if (!playerId) return Response.json({ error: "player_id required" }, { status: 400 });

    const { url, key } = getSupabaseEnv();
    if (!url || !key) return Response.json({ error: "Supabase not configured" }, { status: 500 });

    const res = await fetch(`${url}/rest/v1/rpc/staff_sprint_replay`, {
      method: "POST",
      headers: supabaseHeaders(key, { "Content-Type": "application/json" }),
      body: JSON.stringify({ p_player_id: playerId })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return Response.json({ error: data.message || "replay failed" }, { status: 500 });

    const row = Array.isArray(data) ? data[0] : data;
    return Response.json(row);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
