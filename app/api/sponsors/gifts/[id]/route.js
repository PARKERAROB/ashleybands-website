import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readStaffSession } from "@/lib/sponsorAuth";
import { confirmGift } from "@/lib/sponsorRecognition";

export const runtime = "nodejs";

// Staff actions on a gift (build-spec §6 L2 boundary lives here): confirm a check pledge
// once the money is in hand → fires Lane A recognition (receipt + auto-list + badge). Also
// supports correcting the amount / FMV before confirming, and voiding a pledge that never
// arrived. Staff-only. (Online gifts auto-confirm at PayPal capture and don't need this.)
async function validateStaff(req) {
  const { staffId, token } = readStaffSession(req);
  if (!staffId || !token) return null;
  const { data } = await supabaseAdmin
    .from("staff")
    .select("id, role, display_name, session_token")
    .eq("id", staffId)
    .maybeSingle();
  if (!data || data.session_token !== token) return null;
  return data;
}

function siteOrigin(req) {
  return process.env.NEXT_PUBLIC_SITE_ORIGIN || new URL(req.url).origin;
}

export async function PATCH(req, { params }) {
  const staff = await validateStaff(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => ({}));

  // Optional pre-confirm corrections.
  const pre = {};
  if (Number.isFinite(Number(body.amount_cents)) && Number(body.amount_cents) > 0) {
    pre.amount_cents = Math.round(Number(body.amount_cents));
  }
  if (Number.isFinite(Number(body.fmv_cents)) && Number(body.fmv_cents) >= 0) {
    pre.fmv_cents = Math.round(Number(body.fmv_cents));
  }
  if (typeof body.payer_email === "string") pre.payer_email = body.payer_email.trim();
  if (typeof body.notes === "string") pre.notes = body.notes;
  if (Object.keys(pre).length) {
    const { error } = await supabaseAdmin.from("sponsor_gifts").update(pre).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.action === "confirm") {
    try {
      const result = await confirmGift(id, { confirmedBy: staff.display_name || "staff", origin: siteOrigin(req) });
      return NextResponse.json(result);
    } catch (err) {
      return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
    }
  }

  if (body.action === "void") {
    const { error } = await supabaseAdmin
      .from("sponsor_gifts")
      .update({ status: "void", listed_on_site: false })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: "void" });
  }

  if (body.action === "unlist") {
    const { error } = await supabaseAdmin
      .from("sponsor_gifts")
      .update({ listed_on_site: false })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, updated: Object.keys(pre) });
}
