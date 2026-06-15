import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveSponsorFamily, sponsorFunnelLive } from "@/lib/sponsorFamily";

export const runtime = "nodejs";

// First-paint aggregate for the portal-native family sponsorship dashboard (build-spec §4).
// Everything the family screen needs in one call: their businesses (with claim countdowns),
// how many warmed leads are available to claim, and their dollars toward the $2,000 goal.

export const FAMILY_GOAL_CENTS = 200000; // $2,000 aspirational per-family goal (NEVER a fee)
export const TARGET_BUSINESS_COUNT = 5;

export async function GET(req) {
  if (!sponsorFunnelLive()) {
    return NextResponse.json({ error: "Sponsorship area is not open yet." }, { status: 404 });
  }
  const resolved = await resolveSponsorFamily(req);
  if (!resolved?.family) {
    return NextResponse.json({ error: "Sign in to the Family Portal to open sponsorship." }, { status: 401 });
  }
  const fam = resolved.family;

  const [{ data: prospects, error: pErr }, { count: warmedCount }, { data: totals }] = await Promise.all([
    supabaseAdmin
      .from("prospects")
      .select(
        "id, status, contact_name, contact_email, contact_phone, business_address, relationship_note, contact_mode, lead_kind, contacted_at, dropped_off_at, committed_amount, committed_tier, sent_to_lead, created_at, business:businesses(id, name_display, category, distance_mi, claimed_at, reclaim_at, claim_contacted_at)"
      )
      .eq("family_id", fam.id)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("provenance", "system-sourced")
      .eq("outreach_status", "willing")
      .is("claimed_by_family_id", null),
    supabaseAdmin
      .from("sponsor_family_totals")
      .select("confirmed_gifts, confirmed_cents")
      .eq("family_id", fam.id)
      .maybeSingle()
  ]);

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  return NextResponse.json({
    family: { id: fam.id, display_name: fam.display_name, actor: resolved.actor },
    prospects: prospects || [],
    warmedAvailable: warmedCount || 0,
    confirmedCents: Number(totals?.confirmed_cents || 0),
    confirmedGifts: Number(totals?.confirmed_gifts || 0),
    goalCents: FAMILY_GOAL_CENTS,
    targetBusinessCount: TARGET_BUSINESS_COUNT
  });
}
