import { NextResponse } from "next/server";
import { supabaseAdmin, canonicalName } from "@/lib/supabaseAdmin";
import { resolveSponsorFamily, sponsorFunnelLive } from "@/lib/sponsorFamily";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

const PROSPECT_FIELDS =
  "id, status, contact_name, contact_email, contact_phone, business_address, relationship_note, contact_mode, lead_kind, contacted_at, dropped_off_at, follow_up_at, ask_again_at, committed_amount, committed_tier, sent_to_lead, sent_at, created_at, business:businesses(id, name_display, category)";

async function validateFamily(req) {
  const resolved = await resolveSponsorFamily(req);
  return resolved?.family || null;
}

export async function GET(req) {
  if (!sponsorFunnelLive()) return NextResponse.json({ error: "Sponsorship area is not open yet." }, { status: 404 });
  const fam = await validateFamily(req);
  if (!fam) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("prospects")
    .select(PROSPECT_FIELDS)
    .eq("family_id", fam.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ family: { id: fam.id, display_name: fam.display_name }, prospects: data });
}

export async function POST(req) {
  if (!sponsorFunnelLive()) return NextResponse.json({ error: "Sponsorship area is not open yet." }, { status: 404 });
  const fam = await validateFamily(req);
  if (!fam) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const rate = await checkRateLimit({
    key: `sponsor-prospect:${fam.id}`,
    limit: 15,
    windowMs: 24 * 60 * 60 * 1000,
    failOpen: false
  });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many businesses were added today. Try again tomorrow." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const businessName = String(body.business_name || "").trim();
  if (!businessName) {
    return NextResponse.json({ error: "Business name is required" }, { status: 400 });
  }
  const contactEmail = String(body.contact_email || "").trim();
  const contactPhone = String(body.contact_phone || "").trim();
  if (!contactEmail && !contactPhone) {
    return NextResponse.json(
      { error: "Add an email or phone so we can reach this business." },
      { status: 400 }
    );
  }
  const canonical = canonicalName(businessName);

  // Resolve the business, reusing an existing row wherever possible so the warm
  // list and the cold prospect DB don't accumulate duplicate businesses.
  // Priority: (1) an id the family picked from typeahead, (2) exact canonical
  // match, (3) case-insensitive name match, else (4) create a new row.
  let businessId;
  {
    const pickedId = String(body.business_id || "").trim();
    if (pickedId) {
      const { data: picked } = await supabaseAdmin
        .from("businesses")
        .select("id")
        .eq("id", pickedId)
        .maybeSingle();
      if (picked) businessId = picked.id;
    }
    if (!businessId) {
      const { data: existing } = await supabaseAdmin
        .from("businesses")
        .select("id")
        .eq("name_canonical", canonical)
        .maybeSingle();
      if (existing) businessId = existing.id;
    }
    if (!businessId) {
      const { data: byName } = await supabaseAdmin
        .from("businesses")
        .select("id")
        .ilike("name_display", businessName)
        .maybeSingle();
      if (byName) businessId = byName.id;
    }
    if (!businessId) {
      const { data, error } = await supabaseAdmin
        .from("businesses")
        .insert({ name_canonical: canonical, name_display: businessName })
        .select("id")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      businessId = data.id;
    }
  }

  const contactMode = ["self", "warm_first"].includes(body.contact_mode) ? body.contact_mode : null;

  const insert = {
    family_id: fam.id,
    business_id: businessId,
    contact_name: String(body.contact_name || "").trim() || null,
    contact_email: contactEmail || null,
    contact_phone: contactPhone || null,
    business_address: String(body.business_address || "").trim() || null,
    relationship_note: String(body.relationship_note || "").trim() || null,
    contact_mode: contactMode,
    lead_kind: "family_added",
    status: "pending"
  };
  const { data, error } = await supabaseAdmin
    .from("prospects")
    .insert(insert)
    .select(PROSPECT_FIELDS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prospect: data });
}
