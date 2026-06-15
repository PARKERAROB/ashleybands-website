import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveSponsorFamily } from "@/lib/sponsorFamily";

export const runtime = "nodejs";

// Family-facing typeahead so a family can pick a business that already exists
// (in the 681-row prospect DB or added by another family) instead of typing a
// near-duplicate. Returns names only — no family or outreach data. Authed (portal
// session or legacy PIN) so it isn't a public directory scrape.
export async function GET(req) {
  const resolved = await resolveSponsorFamily(req);
  if (!resolved?.family) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const { data, error } = await supabaseAdmin
    .from("businesses")
    .select("id, name_display, category, city")
    .ilike("name_display", `%${q}%`)
    .order("name_display", { ascending: true })
    .limit(8);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ results: data || [] });
}
