import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sponsorFunnelLive } from "@/lib/sponsorFamily";
import { verifySponsorGiveToken } from "@/lib/sponsorGiveToken.mjs";

export const runtime = "nodejs";

// Public name lookup for a signed family sponsor-payment link. The HMAC token binds the
// business to the family's prospect; raw database ids are never accepted from the browser.
// Returns the display NAME ONLY, never contacts, status, families, or other business fields.
export async function GET(req) {
  if (!sponsorFunnelLive()) {
    return NextResponse.json({ error: "not_open" }, { status: 404 });
  }
  const token = (new URL(req.url).searchParams.get("token") || "").trim();
  if (!token) return NextResponse.json({ name: null });
  const claims = verifySponsorGiveToken(token);
  if (!claims) return NextResponse.json({ error: "invalid_link" }, { status: 400 });

  const { data } = await supabaseAdmin
    .from("businesses")
    .select("name_display")
    .eq("id", claims.businessId)
    .maybeSingle();
  return NextResponse.json({ name: data?.name_display || null });
}
