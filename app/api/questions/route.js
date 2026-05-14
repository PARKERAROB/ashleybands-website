import { getSupabaseEnv } from "@/lib/supabaseEnv";
import { supabaseHeaders } from "@/lib/supabaseRest";

export async function GET() {
  const { url: supabaseUrl, key: supabaseKey } = getSupabaseEnv();

  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/band_questions?select=*&order=created_at.desc`, {
    headers: supabaseHeaders(supabaseKey, {
      "Content-Type": "application/json"
    })
  });

  return Response.json(await res.json(), { status: res.ok ? 200 : 500 });
}

export async function DELETE(request) {
  const { url: supabaseUrl, key: supabaseKey } = getSupabaseEnv();

  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { flaggedOnly } = await request.json().catch(() => ({}));
  const filter = flaggedOnly ? "flagged=eq.true" : "id=neq.00000000-0000-0000-0000-000000000000";
  const res = await fetch(`${supabaseUrl}/rest/v1/band_questions?${filter}`, {
    method: "DELETE",
    headers: supabaseHeaders(supabaseKey, {
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    })
  });

  return Response.json({ ok: res.ok }, { status: res.ok ? 200 : 500 });
}
