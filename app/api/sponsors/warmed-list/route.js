import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveSponsorFamily, sponsorFunnelLive } from "@/lib/sponsorFamily";

export const runtime = "nodejs";

// The warmed list (build-spec §4 step 4 + §12): system-sourced businesses that already
// said they're willing to hear from a family and aren't currently claimed by anyone.
// HARD WALL: returns name + category + distance ONLY. No contact details — those are
// revealed solely on claim, server-side. No browse-all dump: capped, willing-and-unclaimed
// only. (Family contacts stay behind the staff wall.)
export async function GET(req) {
  if (!sponsorFunnelLive()) {
    return NextResponse.json({ error: "Sponsorship area is not open yet." }, { status: 404 });
  }
  const resolved = await resolveSponsorFamily(req);
  if (!resolved?.family) {
    return NextResponse.json({ error: "Sign in to the Family Portal to open sponsorship." }, { status: 401 });
  }

  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  let query = supabaseAdmin
    .from("businesses")
    .select("id, name_display, category, distance_mi")
    .eq("provenance", "system-sourced")
    .eq("outreach_status", "willing")
    .is("claimed_by_family_id", null)
    .order("distance_mi", { ascending: true, nullsFirst: false })
    .limit(40);
  if (q.length >= 2) query = query.ilike("name_display", `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Round distance so we don't imply false precision in the family UI.
  const results = (data || []).map((b) => ({
    id: b.id,
    name_display: b.name_display,
    category: b.category || "",
    distance_mi: b.distance_mi == null ? null : Math.round(Number(b.distance_mi) * 10) / 10
  }));
  return NextResponse.json({ results });
}
