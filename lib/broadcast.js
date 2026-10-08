import { supabaseAdmin } from "./supabaseAdmin.js";
import { activeGuardianLinks, resolveAudience } from "./audience.js";
import { htmlToText, sendBroadcastEmail } from "./portalEmail.js";
import { SITE_ORIGIN } from "./routes.js";
import {
  hasMediaConsentPlaceholder,
  mediaConsentToken,
  personalizeMediaConsent,
  studentFirstName,
  studentsByGuardianEmail,
} from "./mediaConsent.mjs";

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
  createdBy,
  resolvedAudience = null,
  replyTo = null,
}) {
  const { recipients, count, studentCount } = resolvedAudience || await resolveAudience(audienceFilter, recipientAxis);
  if (!count) {
    return { broadcastId: null, count: 0, studentCount, replyTo };
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

  // replyTo is not stored; pass it to dispatchBroadcast. Without it, the portal default applies.
  return { broadcastId: broadcast.id, count, studentCount, replyTo };
}

// Lookups for the {{media_consent}} block (#162): every active student linked to
// each guardian email (dedupe keeps one row per email, so siblings come from here)
// and each student's first name.
export async function loadMediaConsentContext(client = supabaseAdmin) {
  const byEmail = studentsByGuardianEmail(await activeGuardianLinks(client));
  const ids = [...new Set([...byEmail.values()].flat())];
  const names = new Map();
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await client
      .from("portal_students")
      .select("id, preferred_first, legal_first, display_name")
      .in("id", ids.slice(i, i + 100));
    if (error) throw new Error(error.message);
    for (const row of data || []) names.set(row.id, studentFirstName(row));
  }
  return { byEmail, names };
}

// Guardian rows carry person_id; student self rows do not.
export function personalizeForRecipient(bodyHtml, row, context, baseUrl = SITE_ORIGIN) {
  const kind = row.person_id ? "guardian" : "student";
  const students = kind === "guardian"
    ? (context.byEmail.get(String(row.email).trim().toLowerCase()) || [])
      .filter((id) => context.names.has(id))
      .map((id) => ({ firstName: context.names.get(id), token: mediaConsentToken(id) }))
      .sort((a, b) => a.firstName.localeCompare(b.firstName))
    : [];
  return { kind, students, ...personalizeMediaConsent(bodyHtml, { kind, students, baseUrl }, htmlToText) };
}

// Send all not-yet-sent recipients for a broadcast. Resumable: only touches
// rows still 'queued' or 'failed', so re-running after a timeout finishes the job.
// Returns { sent, failed, remaining }.
export async function dispatchBroadcast(broadcastId, { replyTo = null } = {}) {
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
    .select("id, email, student_id, person_id")
    .eq("broadcast_id", broadcastId)
    .in("send_status", ["queued", "failed"]);

  const mediaContext = hasMediaConsentPlaceholder(broadcast.body_html) && (pending || []).length
    ? await loadMediaConsentContext()
    : null;

  let sent = 0;
  let failed = 0;

  for (const row of pending || []) {
    try {
      const personal = mediaContext ? personalizeForRecipient(broadcast.body_html, row, mediaContext) : null;
      const resendId = await sendBroadcastEmail({
        to: row.email,
        subject: broadcast.subject,
        html: personal ? personal.html : broadcast.body_html,
        text: personal ? personal.text : undefined,
        replyTo
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
        .update(err?.code === "contact_suppressed"
          ? { send_status: "skipped", send_error: "contact_suppressed" }
          : { send_status: "failed", send_error: String(err?.message || err).slice(0, 500) })
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
