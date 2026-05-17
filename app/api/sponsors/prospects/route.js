import { NextResponse } from "next/server";
import { supabaseAdmin, canonicalName } from "@/lib/supabaseAdmin";
import { readFamilySession } from "@/lib/sponsorAuth";

export const runtime = "nodejs";

async function validateFamily(req) {
  const { familyId, token } = readFamilySession(req);
  if (!familyId || !token) return null;
  const { data } = await supabaseAdmin
    .from("families")
    .select("id, display_name, session_token")
    .eq("id", familyId)
    .maybeSingle();
  if (!data || data.session_token !== token) return null;
  return data;
}

export async function GET(req) {
  const fam = await validateFamily(req);
  if (!fam) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("prospects")
    .select(
      "id, status, contact_name, relationship_note, dropped_off_at, follow_up_at, ask_again_at, committed_amount, committed_tier, sent_to_lead, sent_at, created_at, business:businesses(id, name_display, category)"
    )
    .eq("family_id", fam.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ family: { id: fam.id, display_name: fam.display_name }, prospects: data });
}

export async function POST(req) {
  const fam = await validateFamily(req);
  if (!fam) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const businessName = String(body.business_name || "").trim();
  if (!businessName) {
    return NextResponse.json({ error: "Business name is required" }, { status: 400 });
  }
  const canonical = canonicalName(businessName);

  // upsert business
  let businessId;
  {
    const { data: existing } = await supabaseAdmin
      .from("businesses")
      .select("id")
      .eq("name_canonical", canonical)
      .maybeSingle();
    if (existing) {
      businessId = existing.id;
    } else {
      const { data, error } = await supabaseAdmin
        .from("businesses")
        .insert({ name_canonical: canonical, name_display: businessName })
        .select("id")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      businessId = data.id;
    }
  }

  const insert = {
    family_id: fam.id,
    business_id: businessId,
    contact_name: String(body.contact_name || "").trim() || null,
    relationship_note: String(body.relationship_note || "").trim() || null,
    status: "pending"
  };
  const { data, error } = await supabaseAdmin
    .from("prospects")
    .insert(insert)
    .select(
      "id, status, contact_name, relationship_note, dropped_off_at, follow_up_at, ask_again_at, committed_amount, committed_tier, sent_to_lead, sent_at, created_at, business:businesses(id, name_display, category)"
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prospect: data });
}
