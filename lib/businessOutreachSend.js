import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendBroadcastEmail } from "@/lib/portalEmail";
import {
  COLD_EMAIL_SUBJECT,
  renderColdEmailHTML,
  renderColdEmailText
} from "@/lib/businessOutreachEmail";

// Cold-outreach dispatcher. Sends queued business_outreach rows through Resend on
// the already-verified ashleybands.com domain — independent of any NHCS Google or
// Microsoft account. This replaces the local gws/Gmail drain script as the primary
// path, so a school-account change can't break the campaign.
//
// L2 holds: nothing here runs on a schedule. It only fires from the staff
// send-queue route, behind an explicit "confirm" click, exactly like broadcasts.

// Sender lives on the verified Resend domain (director.ashleybands.com). Replies
// route to the director's inbox. Both overridable by env without code changes.
const SPONSOR_FROM =
  process.env.SPONSOR_EMAIL_FROM || "Ashley Bands Sponsorships <sponsorship@director.ashleybands.com>";
const SPONSOR_REPLY_TO = process.env.SPONSOR_EMAIL_REPLY_TO || "robert.parker@nhcs.net";

export async function countQueued() {
  const { count } = await supabaseAdmin
    .from("business_outreach")
    .select("id", { count: "exact", head: true })
    .eq("send_status", "queued");
  return count || 0;
}

// Send every queued outreach row (optionally capped). Resumable: only touches rows
// still 'queued', so re-running after a timeout finishes the job.
// Returns { sent, failed, remaining }.
export async function dispatchOutreachQueue({ limit = 0 } = {}) {
  let q = supabaseAdmin
    .from("business_outreach")
    .select("id, business_id, sent_to_email, yes_url, no_url, business:businesses(name_display, contact_person)")
    .eq("send_status", "queued")
    .order("queued_at", { ascending: true });
  if (limit > 0) q = q.limit(limit);

  const { data: queued, error } = await q;
  if (error) throw new Error(error.message);

  let sent = 0;
  let failed = 0;

  for (const row of queued || []) {
    const businessName = row.business?.name_display || "";
    const contactFirst = row.business?.contact_person
      ? row.business.contact_person.split(/\s+/)[0]
      : "";
    try {
      if (!row.sent_to_email) throw new Error("No recipient email on outreach row");
      const resendId = await sendBroadcastEmail({
        to: row.sent_to_email,
        subject: COLD_EMAIL_SUBJECT,
        html: renderColdEmailHTML({ businessName, contactFirst, yesUrl: row.yes_url, noUrl: row.no_url }),
        text: renderColdEmailText({ businessName, contactFirst, yesUrl: row.yes_url, noUrl: row.no_url }),
        from: SPONSOR_FROM,
        replyTo: SPONSOR_REPLY_TO
      });
      await supabaseAdmin
        .from("business_outreach")
        .update({
          send_status: "sent",
          sent_at: new Date().toISOString(),
          gmail_message_id: resendId, // external message id (Resend) for audit
          send_error: null
        })
        .eq("id", row.id);
      sent += 1;
    } catch (err) {
      await supabaseAdmin
        .from("business_outreach")
        .update({
          send_status: "failed",
          send_error: String(err?.message || err).slice(0, 500)
        })
        .eq("id", row.id);
      failed += 1;
    }
  }

  const remaining = await countQueued();
  return { sent, failed, remaining };
}
