import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readStaffSession } from "@/lib/sponsorAuth";

export const runtime = "nodejs";

const ALLOWED = [
  "name_display",
  "address",
  "city",
  "zip",
  "phone",
  "email",
  "website",
  "contact_person",
  "contact_title",
  "category",
  "zone",
  "outreach_status",
  "prior_sponsor",
  "notes"
];

async function validateStaff(req) {
  const { staffId, token } = readStaffSession(req);
  if (!staffId || !token) return null;
  const { data } = await supabaseAdmin
    .from("staff")
    .select("id, role, session_token")
    .eq("id", staffId)
    .maybeSingle();
  if (!data || data.session_token !== token) return null;
  return data;
}

export async function PATCH(req, { params }) {
  const staff = await validateStaff(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const update = {};
  for (const key of ALLOWED) {
    if (key in body) update[key] = body[key] === "" ? null : body[key];
  }
  // Stamp willing_at / declined_at when status transitions to those.
  if (update.outreach_status === "willing") update.willing_at = new Date().toISOString();
  if (update.outreach_status === "declined") update.declined_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("businesses")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ business: data });
}

export async function DELETE(req, { params }) {
  const staff = await validateStaff(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const { error } = await supabaseAdmin.from("businesses").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
