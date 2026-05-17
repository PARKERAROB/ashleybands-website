import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readFamilySession, readStaffSession } from "@/lib/sponsorAuth";

export const runtime = "nodejs";

const ALLOWED = [
  "status",
  "contact_name",
  "relationship_note",
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
    .select("id, family_id")
    .eq("id", prospectId)
    .maybeSingle();
  if (!prospect) return { ok: false, status: 404, error: "Prospect not found" };

  const fam = readFamilySession(req);
  if (fam.familyId && fam.token) {
    const { data } = await supabaseAdmin
      .from("families")
      .select("id, session_token")
      .eq("id", fam.familyId)
      .maybeSingle();
    if (data && data.session_token === fam.token && data.id === prospect.family_id) {
      return { ok: true, prospect };
    }
  }

  const staff = readStaffSession(req);
  if (staff.staffId && staff.token) {
    const { data } = await supabaseAdmin
      .from("staff")
      .select("id, session_token")
      .eq("id", staff.staffId)
      .maybeSingle();
    if (data && data.session_token === staff.token) {
      return { ok: true, prospect };
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

  const { data, error } = await supabaseAdmin
    .from("prospects")
    .update(update)
    .eq("id", id)
    .select(
      "id, status, contact_name, relationship_note, dropped_off_at, follow_up_at, ask_again_at, committed_amount, committed_tier, sent_to_lead, sent_at, business:businesses(id, name_display)"
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
