import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveSponsorFamily, sponsorFunnelLive } from "@/lib/sponsorFamily";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

// "Have the band email them first" (build-spec §4 step 2). The same warming mechanism as the
// cold campaign, now an on-demand tool for a family's OWN business contact: handles the
// "regular at the restaurant but doesn't know the manager" case.
//
// This QUEUES a warming email through the existing business_outreach pipeline. It does not
// send here — dispatch stays behind the staff send-queue / SPONSOR send flag (L2: no email
// leaves on its own). When the funnel goes live the queued row sends through the same
// already-verified Resend path as the cold campaign.
const WARM_CAMPAIGN = "family-warm-request";

function siteOrigin(req) {
  return process.env.NEXT_PUBLIC_SITE_ORIGIN || new URL(req.url).origin;
}

export async function POST(req) {
  if (!sponsorFunnelLive()) {
    return NextResponse.json({ error: "Sponsorship area is not open yet." }, { status: 404 });
  }
  const resolved = await resolveSponsorFamily(req);
  if (!resolved?.family) {
    return NextResponse.json({ error: "Sign in to the Family Portal to open sponsorship." }, { status: 401 });
  }
  const fam = resolved.family;

  const rate = await checkRateLimit({
    key: `sponsor-warm:${fam.id}`,
    limit: 5,
    windowMs: 24 * 60 * 60 * 1000,
    failOpen: false
  });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many email requests were queued today. Try again tomorrow." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const prospectId = String(body.prospect_id || "").trim();
  if (!prospectId) return NextResponse.json({ error: "Missing prospect." }, { status: 400 });

  const { data: prospect } = await supabaseAdmin
    .from("prospects")
    .select("id, family_id, business_id, contact_email")
    .eq("id", prospectId)
    .maybeSingle();
  if (!prospect || prospect.family_id !== fam.id) {
    return NextResponse.json({ error: "That business is not on your list." }, { status: 404 });
  }
  if (!prospect.contact_email) {
    return NextResponse.json(
      { error: "Add an email for this business so we can warm them up first." },
      { status: 400 }
    );
  }

  await supabaseAdmin.from("prospects").update({ contact_mode: "warm_first" }).eq("id", prospect.id);

  // Don't double-queue the same business+campaign.
  const { data: existing } = await supabaseAdmin
    .from("business_outreach")
    .select("id, send_status")
    .eq("business_id", prospect.business_id)
    .eq("campaign", WARM_CAMPAIGN)
    .in("send_status", ["queued", "sent"])
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, alreadyQueued: true, send_status: existing.send_status });
  }

  const clickToken = crypto.randomUUID();
  const origin = siteOrigin(req);
  const yesUrl = `${origin}/sponsors/respond?t=${clickToken}&a=yes`;
  const noUrl = `${origin}/sponsors/respond?t=${clickToken}&a=no`;

  const { error: insErr } = await supabaseAdmin.from("business_outreach").insert({
    business_id: prospect.business_id,
    campaign: WARM_CAMPAIGN,
    sent_to_email: prospect.contact_email,
    click_token: clickToken,
    send_status: "queued",
    yes_url: yesUrl,
    no_url: noUrl
  });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, queued: true });
}
