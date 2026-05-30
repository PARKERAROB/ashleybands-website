import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAudience } from "@/lib/audience";
import { sendBroadcastEmail } from "@/lib/portalEmail";

// Create + dispatch logic for the communication layer. Routes stay thin; the
// L2 guardrail lives at the API boundary (only Rob's authenticated click calls
// dispatch). Nothing here runs on a schedule.

// Turn a plain-text compose body into safe HTML paragraphs.
export function bodyToHtml(body) {
  const escaped = String(body || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${block.replaceAll("\n", "<br/>")}</p>`);
  return paragraphs.join("\n");
}

// Resolve an audience and persist a broadcast + its recipient rows (status queued).
// Does NOT send. Returns { broadcastId, count, studentCount }.
export async function createBroadcast({
  subject,
  body,
  audienceFilter,
  recipientAxis,
  createdBy
}) {
  const { recipients, count, studentCount } = await resolveAudience(
    audienceFilter,
    recipientAxis
  );
  if (!count) {
    return { broadcastId: null, count: 0, studentCount };
  }

  const bodyHtml = bodyToHtml(body);

  const { data: broadcast, error } = await supabaseAdmin
    .from("broadcasts")
    .insert({
      subject,
      body_html: bodyHtml,
      audience_filter: audienceFilter || {},
      recipient_axis: recipientAxis,
      status: "sending",
      created_by: createdBy || "",
      recipient_count: count
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const rows = recipients.map((r) => ({
    broadcast_id: broadcast.id,
    student_id: r.student_id,
    person_id: r.person_id,
    email: r.email,
    send_status: "queued"
  }));

  // Chunk inserts to stay well under any row limit.
  for (let i = 0; i < rows.length; i += 500) {
    const { error: insErr } = await supabaseAdmin
      .from("broadcast_recipients")
      .insert(rows.slice(i, i + 500));
    if (insErr) throw new Error(insErr.message);
  }

  return { broadcastId: broadcast.id, count, studentCount };
}

// Send all not-yet-sent recipients for a broadcast. Resumable: only touches
// rows still 'queued' or 'failed', so re-running after a timeout finishes the job.
// Returns { sent, failed, remaining }.
export async function dispatchBroadcast(broadcastId) {
  const { data: broadcast, error: bErr } = await supabaseAdmin
    .from("broadcasts")
    .select("id, subject, body_html, status")
    .eq("id", broadcastId)
    .maybeSingle();
  if (bErr) throw new Error(bErr.message);
  if (!broadcast) throw new Error("Broadcast not found.");

  await supabaseAdmin
    .from("broadcasts")
    .update({ status: "sending" })
    .eq("id", broadcastId);

  const { data: pending } = await supabaseAdmin
    .from("broadcast_recipients")
    .select("id, email")
    .eq("broadcast_id", broadcastId)
    .in("send_status", ["queued", "failed"]);

  let sent = 0;
  let failed = 0;

  for (const row of pending || []) {
    try {
      const resendId = await sendBroadcastEmail({
        to: row.email,
        subject: broadcast.subject,
        html: broadcast.body_html
      });
      await supabaseAdmin
        .from("broadcast_recipients")
        .update({
          send_status: "sent",
          resend_id: resendId,
          send_error: "",
          sent_at: new Date().toISOString()
        })
        .eq("id", row.id);
      sent += 1;
    } catch (err) {
      await supabaseAdmin
        .from("broadcast_recipients")
        .update({
          send_status: "failed",
          send_error: String(err?.message || err).slice(0, 500)
        })
        .eq("id", row.id);
      failed += 1;
    }
  }

  // Recount remaining unsent to finalize broadcast status.
  const { count: remaining } = await supabaseAdmin
    .from("broadcast_recipients")
    .select("id", { count: "exact", head: true })
    .eq("broadcast_id", broadcastId)
    .in("send_status", ["queued", "failed"]);

  const finalStatus = remaining ? "failed" : "sent";
  await supabaseAdmin
    .from("broadcasts")
    .update({
      status: finalStatus,
      sent_at: finalStatus === "sent" ? new Date().toISOString() : null
    })
    .eq("id", broadcastId);

  return { sent, failed, remaining: remaining || 0 };
}
