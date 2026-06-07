import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sponsorFunnelLive } from "@/lib/sponsorFamily";

export const runtime = "nodejs";

// Public name lookup so the business give page can show "You're giving to support
// <business>" when reached from a kid's QR/card link (?b=<id>). Returns the display NAME
// ONLY — never contacts, status, families, or any other business field.
export async function GET(req) {
  if (!sponsorFunnelLive()) {
    return NextResponse.json({ error: "not_open" }, { status: 404 });
  }
  const id = (new URL(req.url).searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ name: null });

  const { data } = await supabaseAdmin
    .from("businesses")
    .select("name_display")
    .eq("id", id)
    .maybeSingle();
  return NextResponse.json({ name: data?.name_display || null });
}
