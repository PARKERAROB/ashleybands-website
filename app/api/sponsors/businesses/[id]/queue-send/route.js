import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorizeStaffRequest, STAFF_CAPABILITIES } from "@/lib/staffAuthorization";
import { logAuditRequired, staffActor } from "@/lib/auditLog";
import { privateJson, privateServerError } from "@/lib/privateResponse";
import { CAMPAIGN_ID } from "@/lib/businessOutreachEmail";
import crypto from "node:crypto";

export const runtime = "nodejs";

function siteOrigin(req) {
  return process.env.NEXT_PUBLIC_SITE_ORIGIN || new URL(req.url).origin;
}

export async function POST(req, { params }) {
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.SPONSORSHIP_WRITE);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  const staff = authorization.staff;

  const { id: businessId } = await params;

  const { data: biz, error: bizErr } = await supabaseAdmin
    .from("businesses")
    .select("id, name_display, email, outreach_status")
    .eq("id", businessId)
    .maybeSingle();
  if (bizErr) return privateServerError("sponsor-queue", bizErr, "The sponsor business could not be loaded.");
  if (!biz) return privateJson({ error: "Business not found" }, 404);
  if (!biz.email) return privateJson({ error: "Business has no email — add one before queueing" }, 400);
  if (["already-sponsor", "skip", "willing", "declined"].includes(biz.outreach_status)) {
    return privateJson({ error: `Business status is "${biz.outreach_status}" — refusing to queue` }, 400);
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
    return privateJson({ error: `Already ${existing.send_status} for this campaign` }, 409);
  }

  const clickToken = crypto.randomUUID();
  const origin = siteOrigin(req);
  // Point at the read-only confirm page (not the mutating API route) so mail
  // scanners that prefetch the link can't answer on the business's behalf.
  const yesUrl = `${origin}/sponsors/respond?t=${clickToken}&a=yes`;
  const noUrl = `${origin}/sponsors/respond?t=${clickToken}&a=no`;

  try {
    await logAuditRequired({ actor: staffActor(staff), action: "queue_requested", table: "business_outreach", recordId: businessId, route: "/api/sponsors/businesses/[id]/queue-send", changes: { businessId } });
  } catch (error) {
    return privateServerError("sponsor-queue-audit", error, "Sponsor outreach could not be queued.");
  }

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
  if (insErr) return privateServerError("sponsor-queue", insErr, "Sponsor outreach could not be queued.");

  // Mark the business as "asked" so the dashboard shows it's in the pipeline
  await supabaseAdmin
    .from("businesses")
    .update({ outreach_status: "asked", last_outreach_at: new Date().toISOString() })
    .eq("id", businessId);

  return privateJson({ outreach });
}

export async function DELETE(req, { params }) {
  // Un-queue: removes the queued row + flips business back to 'untested'.
  // Only works if the outreach is still queued (never sent).
  const authorization = await authorizeStaffRequest(req, STAFF_CAPABILITIES.SPONSORSHIP_WRITE);
  if (!authorization.ok) return privateJson({ error: authorization.error }, authorization.status);
  const { id: businessId } = await params;

  const { data: existing } = await supabaseAdmin
    .from("business_outreach")
    .select("id, send_status")
    .eq("business_id", businessId)
    .eq("campaign", CAMPAIGN_ID)
    .eq("send_status", "queued")
    .maybeSingle();
  if (!existing) return privateJson({ error: "Nothing queued to remove" }, 404);

  try {
    await logAuditRequired({ actor: staffActor(authorization.staff), action: "unqueue_requested", table: "business_outreach", recordId: existing.id, route: "/api/sponsors/businesses/[id]/queue-send", changes: { businessId } });
  } catch (error) {
    return privateServerError("sponsor-queue-audit", error, "Sponsor outreach could not be removed from the queue.");
  }

  await supabaseAdmin.from("business_outreach").delete().eq("id", existing.id);
  await supabaseAdmin
    .from("businesses")
    .update({ outreach_status: "untested" })
    .eq("id", businessId);

  return privateJson({ ok: true });
}
