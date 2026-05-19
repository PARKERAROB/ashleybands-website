import { getSupabaseEnv } from "@/lib/supabaseEnv";
import { supabaseHeaders } from "@/lib/supabaseRest";

const MODES = ["treble_beginner", "bass_beginner", "mixed_beginner"];

export async function POST(request) {
  try {
    const body = await request.json();
    const mode = MODES.includes(body.mode) ? body.mode : "treble_beginner";
    const raceSize = Math.min(8, Math.max(2, Number(body.race_size) || 6));
    const winScore = Math.min(50, Math.max(5, Number(body.win_score) || 20));

    const { url, key } = getSupabaseEnv();
    if (!url || !key) return Response.json({ error: "Supabase not configured" }, { status: 500 });

    const res = await fetch(`${url}/rest/v1/rpc/staff_sprint_create_session`, {
      method: "POST",
      headers: supabaseHeaders(key, { "Content-Type": "application/json" }),
      body: JSON.stringify({ p_mode: mode, p_race_size: raceSize, p_win_score: winScore })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return Response.json({ error: data.message || "create failed" }, { status: 500 });

    return Response.json(data);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
