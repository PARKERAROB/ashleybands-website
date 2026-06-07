import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sponsorFunnelLive, sponsorRecognitionLive } from "@/lib/sponsorFamily";
import { signClaimToken } from "@/lib/sponsorClaimToken";
import { sendBroadcastEmail } from "@/lib/portalEmail";

export const runtime = "nodejs";

// Reclaim automation sweep (build-spec §8). Runs daily via Vercel Cron:
//   1. AUTO-RELEASE every claim past its 1-week clock that was never marked contacted.
//   2. DAY-6 NUDGE: email the family one last "have you contacted them?" with two
//      magic-link buttons before it opens to the pool tomorrow.
//
// The release step is safe and always runs (no external send). The nudge EMAIL is held until
// SPONSOR_RECOGNITION_LIVE is true (L2: no email leaves on its own). When the nudge is dark,
// claims still auto-release on time — families just don't get the warning email yet.

const SPONSOR_FROM =
  process.env.SPONSOR_EMAIL_FROM || "Ashley Bands Sponsorships <sponsorship@director.ashleybands.com>";
const SPONSOR_REPLY_TO = process.env.SPONSOR_EMAIL_REPLY_TO || "robert.parker@nhcs.net";

function siteOrigin(req) {
  return process.env.NEXT_PUBLIC_SITE_ORIGIN || new URL(req.url).origin;
}

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev / unset: allow
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// Resolve a portal-bridged family's first usable email (for the nudge).
async function familyEmail(familyId) {
  const { data: fam } = await supabaseAdmin
    .from("families")
    .select("portal_person_id")
    .eq("id", familyId)
    .maybeSingle();
  if (!fam?.portal_person_id) return null;
  const { data: contacts } = await supabaseAdmin
    .from("portal_contact_methods")
    .select("value_display, verification_status")
    .eq("person_id", fam.portal_person_id)
    .eq("contact_type", "email");
  const live = (contacts || []).find(
    (c) => !["hard_bounce", "replaced", "superseded"].includes(c.verification_status)
  );
  return live?.value_display || null;
}

async function run(req) {
  const now = new Date();
  const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  let released = 0;
  let nudged = 0;

  // 1. Auto-release expired, un-contacted claims.
  const { data: expired } = await supabaseAdmin
    .from("businesses")
    .select("id, claimed_by_family_id")
    .not("claimed_by_family_id", "is", null)
    .is("claim_contacted_at", null)
    .lt("reclaim_at", now.toISOString());
  for (const biz of expired || []) {
    await supabaseAdmin
      .from("businesses")
      .update({ claimed_by_family_id: null, claimed_at: null, reclaim_at: null, reclaim_nudged_at: null })
      .eq("id", biz.id);
    await supabaseAdmin
      .from("prospects")
      .delete()
      .eq("family_id", biz.claimed_by_family_id)
      .eq("business_id", biz.id)
      .eq("lead_kind", "claimed_warm")
      .is("contacted_at", null);
    released += 1;
  }

  // 2. Day-6 nudges (within 24h of release, not contacted, not already nudged).
  if (sponsorRecognitionLive()) {
    const { data: dueSoon } = await supabaseAdmin
      .from("businesses")
      .select("id, name_display, claimed_by_family_id, reclaim_at")
      .not("claimed_by_family_id", "is", null)
      .is("claim_contacted_at", null)
      .is("reclaim_nudged_at", null)
      .gte("reclaim_at", now.toISOString())
      .lte("reclaim_at", soon.toISOString());
    const origin = siteOrigin(req);
    for (const biz of dueSoon || []) {
      const to = await familyEmail(biz.claimed_by_family_id);
      if (!to) continue;
      const token = signClaimToken({ businessId: biz.id, familyId: biz.claimed_by_family_id });
      const wentUrl = `${origin}/api/sponsors/claim-action?t=${encodeURIComponent(token)}&a=went`;
      const poolUrl = `${origin}/api/sponsors/claim-action?t=${encodeURIComponent(token)}&a=pool`;
      try {
        await sendBroadcastEmail({
          to,
          subject: `One day left on ${biz.name_display}`,
          html: [
            `<p>You claimed <strong>${biz.name_display}</strong> for Ashley Bands sponsorship outreach. It opens back up to other families tomorrow.</p>`,
            `<p>Have you contacted them yet?</p>`,
            `<p><a href="${wentUrl}" style="display:inline-block;background:#2f7a2f;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none;font-weight:600;margin-right:8px">I went to see them</a>`,
            `<a href="${poolUrl}" style="display:inline-block;background:#f0f0f0;color:#555;padding:10px 18px;border-radius:4px;text-decoration:none;font-weight:600">Send it to the pool</a></p>`,
            `<p style="color:#6f675a;font-size:13px">No rush — if you went, just tap the first button so it stays yours.</p>`
          ].join(""),
          from: SPONSOR_FROM,
          replyTo: SPONSOR_REPLY_TO
        });
        await supabaseAdmin
          .from("businesses")
          .update({ reclaim_nudged_at: now.toISOString() })
          .eq("id", biz.id);
        nudged += 1;
      } catch {
        // leave un-nudged; next sweep retries
      }
    }
  }

  return { released, nudged, nudgesLive: sponsorRecognitionLive() };
}

export async function GET(req) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!sponsorFunnelLive()) return NextResponse.json({ skipped: "funnel_dark" });
  return NextResponse.json(await run(req));
}

// Allow manual POST trigger (staff/debug) with the same auth.
export async function POST(req) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!sponsorFunnelLive()) return NextResponse.json({ skipped: "funnel_dark" });
  return NextResponse.json(await run(req));
}
