import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveSponsorFamily, sponsorFunnelLive } from "@/lib/sponsorFamily";

export const runtime = "nodejs";

// One-pool assignment + reclaim (build-spec §3b, §8). A warmed lead can be claimed by at
// most ONE family at a time. Claiming hides it from the pool, reveals the contact to the
// claiming family only, and starts a 1-week reclaim clock.
export const CLAIM_DAYS = 7;

const CLAIMED_PROSPECT_FIELDS =
  "id, status, contact_name, contact_email, contact_phone, business_address, relationship_note, contact_mode, lead_kind, contacted_at, dropped_off_at, created_at, business:businesses(id, name_display, category, distance_mi, claimed_at, reclaim_at, claim_contacted_at)";

async function gate(req) {
  if (!sponsorFunnelLive()) return { error: "Sponsorship area is not open yet.", status: 404 };
  const resolved = await resolveSponsorFamily(req);
  if (!resolved?.family) return { error: "Sign in to the Family Portal to open sponsorship.", status: 401 };
  return { family: resolved.family };
}

// Claim a warmed lead.
export async function POST(req) {
  const g = await gate(req);
  if (g.error) return NextResponse.json({ error: g.error }, { status: g.status });
  const fam = g.family;

  const body = await req.json().catch(() => ({}));
  const businessId = String(body.business_id || "").trim();
  if (!businessId) return NextResponse.json({ error: "Missing business." }, { status: 400 });

  const now = new Date();
  const reclaimAt = new Date(now.getTime() + CLAIM_DAYS * 24 * 60 * 60 * 1000);

  // Atomic guarded claim: only succeeds if the lead is still willing, system-sourced, and
  // unclaimed. The .is() filter prevents two families racing to the same lead.
  const { data: claimed, error: claimErr } = await supabaseAdmin
    .from("businesses")
    .update({
      claimed_by_family_id: fam.id,
      claimed_at: now.toISOString(),
      reclaim_at: reclaimAt.toISOString(),
      claim_contacted_at: null,
      reclaim_nudged_at: null
    })
    .eq("id", businessId)
    .eq("provenance", "system-sourced")
    .eq("outreach_status", "willing")
    .is("claimed_by_family_id", null)
    .select("id, name_display, category, email, phone, contact_person, address, distance_mi, claimed_at, reclaim_at")
    .maybeSingle();
  if (claimErr) return NextResponse.json({ error: claimErr.message }, { status: 500 });
  if (!claimed) {
    return NextResponse.json(
      { error: "That lead was just claimed by another family. Pick another." },
      { status: 409 }
    );
  }

  // Reveal the contact to the claiming family by seeding their prospect from the business.
  // Reuse an existing prospect for this family+business if one is already there.
  const { data: existing } = await supabaseAdmin
    .from("prospects")
    .select("id")
    .eq("family_id", fam.id)
    .eq("business_id", businessId)
    .maybeSingle();

  const prospectPayload = {
    family_id: fam.id,
    business_id: businessId,
    contact_name: claimed.contact_person || null,
    contact_email: claimed.email || null,
    contact_phone: claimed.phone || null,
    business_address: claimed.address || null,
    contact_mode: "self",
    lead_kind: "claimed_warm",
    status: "pending"
  };

  let prospect;
  if (existing) {
    const { data, error } = await supabaseAdmin
      .from("prospects")
      .update(prospectPayload)
      .eq("id", existing.id)
      .select(CLAIMED_PROSPECT_FIELDS)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    prospect = data;
  } else {
    const { data, error } = await supabaseAdmin
      .from("prospects")
      .insert(prospectPayload)
      .select(CLAIMED_PROSPECT_FIELDS)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    prospect = data;
  }

  return NextResponse.json({ prospect, reclaim_at: claimed.reclaim_at });
}

// Release a claimed lead back to the pool (manual, or via the day-6 nudge "send to pool").
export async function DELETE(req) {
  const g = await gate(req);
  if (g.error) return NextResponse.json({ error: g.error }, { status: g.status });
  const fam = g.family;

  const body = await req.json().catch(() => ({}));
  const businessId = String(body.business_id || "").trim();
  if (!businessId) return NextResponse.json({ error: "Missing business." }, { status: 400 });

  const { data: released } = await supabaseAdmin
    .from("businesses")
    .update({ claimed_by_family_id: null, claimed_at: null, reclaim_at: null, claim_contacted_at: null, reclaim_nudged_at: null })
    .eq("id", businessId)
    .eq("claimed_by_family_id", fam.id)
    .select("id")
    .maybeSingle();
  if (!released) {
    return NextResponse.json({ error: "That lead is not currently yours." }, { status: 409 });
  }

  // Drop the un-contacted claimed_warm prospect so it disappears from their dashboard.
  await supabaseAdmin
    .from("prospects")
    .delete()
    .eq("family_id", fam.id)
    .eq("business_id", businessId)
    .eq("lead_kind", "claimed_warm")
    .is("contacted_at", null);

  return NextResponse.json({ ok: true });
}
