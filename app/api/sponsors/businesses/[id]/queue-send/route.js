import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readStaffSession } from "@/lib/sponsorAuth";
import { CAMPAIGN_ID } from "@/lib/businessOutreachEmail";
import crypto from "node:crypto";

export const runtime = "nodejs";

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

function siteOrigin(req) {
  return process.env.NEXT_PUBLIC_SITE_ORIGIN || new URL(req.url).origin;
}

export async function POST(req, { params }) {
  const staff = await validateStaff(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id: businessId } = await params;

  const { data: biz, error: bizErr } = await supabaseAdmin
    .from("businesses")
    .select("id, name_display, email, outreach_status")
    .eq("id", businessId)
    .maybeSingle();
  if (bizErr) return NextResponse.json({ error: bizErr.message }, { status: 500 });
  if (!biz) return NextResponse.json({ error: "Business not found" }, { status: 404 });
  if (!biz.email) return NextResponse.json({ error: "Business has no email — add one before queueing" }, { status: 400 });
  if (["already-sponsor", "skip", "willing", "declined"].includes(biz.outreach_status)) {
    return NextResponse.json({ error: `Business status is "${biz.outreach_status}" — refusing to queue` }, { status: 400 });
  }

  // Don't double-queue an active (queued or sent) outreach for the same business/campaign
  const { data: existing } = await supabaseAdmin
    .from("business_outreach")
    .select("id, send_status")
    .eq("business_id", businessId)
    .eq("campaign", CAMPAIGN_ID)
    .in("send_status", ["queued", "sent"])
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: `Already ${existing.send_status} for this campaign` }, { status: 409 });
  }

  const clickToken = crypto.randomUUID();
  const origin = siteOrigin(req);
  const yesUrl = `${origin}/api/sponsors/business-respond?t=${clickToken}&a=yes`;
  const noUrl = `${origin}/api/sponsors/business-respond?t=${clickToken}&a=no`;

  const { data: outreach, error: insErr } = await supabaseAdmin
    .from("business_outreach")
    .insert({
      business_id: businessId,
      campaign: CAMPAIGN_ID,
      sent_to_email: biz.email,
      sent_by_staff_id: staff.id,
      click_token: clickToken,
      send_status: "queued",
      yes_url: yesUrl,
      no_url: noUrl
    })
    .select("id, send_status, queued_at, click_token")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Mark the business as "asked" so the dashboard shows it's in the pipeline
  await supabaseAdmin
    .from("businesses")
    .update({ outreach_status: "asked", last_outreach_at: new Date().toISOString() })
    .eq("id", businessId);

  return NextResponse.json({ outreach });
}

export async function DELETE(req, { params }) {
  // Un-queue: removes the queued row + flips business back to 'untested'.
  // Only works if the outreach is still queued (never sent).
  const staff = await validateStaff(req);
  if (!staff) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id: businessId } = await params;

  const { data: existing } = await supabaseAdmin
    .from("business_outreach")
    .select("id, send_status")
    .eq("business_id", businessId)
    .eq("campaign", CAMPAIGN_ID)
    .eq("send_status", "queued")
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Nothing queued to remove" }, { status: 404 });

  await supabaseAdmin.from("business_outreach").delete().eq("id", existing.id);
  await supabaseAdmin
    .from("businesses")
    .update({ outreach_status: "untested" })
    .eq("id", businessId);

  return NextResponse.json({ ok: true });
}
