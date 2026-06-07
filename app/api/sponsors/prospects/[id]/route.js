import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readStaffSession } from "@/lib/sponsorAuth";
import { resolveSponsorFamily } from "@/lib/sponsorFamily";

export const runtime = "nodejs";

const ALLOWED = [
  "status",
  "contact_name",
  "contact_email",
  "contact_phone",
  "business_address",
  "relationship_note",
  "contact_mode",
  "dropped_off_at",
  "follow_up_at",
  "ask_again_at",
  "committed_amount",
  "committed_tier",
  "sent_to_lead"
];

async function authorize(req, prospectId) {
  const { data: prospect } = await supabaseAdmin
    .from("prospects")
    .select("id, family_id, business_id, lead_kind")
    .eq("id", prospectId)
    .maybeSingle();
  if (!prospect) return { ok: false, status: 404, error: "Prospect not found" };

  const resolved = await resolveSponsorFamily(req);
  if (resolved?.family && resolved.family.id === prospect.family_id) {
    return { ok: true, prospect, actor: "family" };
  }

  const staff = readStaffSession(req);
  if (staff.staffId && staff.token) {
    const { data } = await supabaseAdmin
      .from("staff")
      .select("id, session_token")
      .eq("id", staff.staffId)
      .maybeSingle();
    if (data && data.session_token === staff.token) {
      return { ok: true, prospect, actor: "staff" };
    }
  }

  return { ok: false, status: 401, error: "Not signed in" };
}

export async function PATCH(req, { params }) {
  const { id } = await params;
  const auth = await authorize(req, id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const update = {};
  for (const key of ALLOWED) {
    if (key in body) update[key] = body[key];
  }
  if (body.status === "yes" && body.sent_to_lead === true && !body.sent_at) {
    update.sent_at = new Date().toISOString();
  }

  // Mark-contacted (build-spec §4 step 5): the student reports they made contact. Record the
  // timestamp and — if this is a claimed warmed lead — freeze the reclaim timer so the
  // business stays theirs (claim_contacted_at), instead of auto-releasing back to the pool.
  if (body.contacted === true) {
    const now = new Date().toISOString();
    update.contacted_at = now;
    if (!("dropped_off_at" in update)) update.dropped_off_at = now.slice(0, 10);
    await supabaseAdmin
      .from("businesses")
      .update({ claim_contacted_at: now })
      .eq("id", auth.prospect.business_id)
      .eq("claimed_by_family_id", auth.prospect.family_id);
  }

  // Confirming money is a staff-only action — families can report a "yes" but only
  // the sponsor lead, holding the signed form, marks it confirmed (banked).
  if ("confirmed_by_lead" in body) {
    if (auth.actor !== "staff") {
      return NextResponse.json({ error: "Only staff can confirm a commitment." }, { status: 403 });
    }
    const confirmed = body.confirmed_by_lead === true;
    update.confirmed_by_lead = confirmed;
    update.confirmed_at = confirmed ? new Date().toISOString() : null;
  }

  const { data, error } = await supabaseAdmin
    .from("prospects")
    .update(update)
    .eq("id", id)
    .select(
      "id, status, contact_name, contact_email, contact_phone, business_address, relationship_note, contact_mode, lead_kind, contacted_at, dropped_off_at, follow_up_at, ask_again_at, committed_amount, committed_tier, sent_to_lead, sent_at, confirmed_by_lead, confirmed_at, business:businesses(id, name_display)"
    )
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prospect: data });
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  const auth = await authorize(req, id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { error } = await supabaseAdmin.from("prospects").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
