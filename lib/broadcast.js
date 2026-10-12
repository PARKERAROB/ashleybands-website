import { supabaseAdmin } from "./supabaseAdmin.js";
import { activeGuardianLinks, allStudentIds, resolveAudience } from "./audience.js";
import { htmlToText, sendBroadcastEmail } from "./portalEmail.js";
import { sendFailureUpdate } from "./contactSuppression.js";
import { SITE_ORIGIN } from "./routes.js";
import {
  MEDIA_CONSENT_RE,
  fillPlaceholders,
  hasMediaConsentPlaceholder,
  mediaConsentRecipientBlock,
  mediaConsentToken,
  studentFirstName,
  studentsByGuardianEmail,
} from "./mediaConsent.mjs";
import { CARNEGIE_LINK_RE, carnegieLinkBlock, hasCarnegieLinkPlaceholder } from "./carnegieLink.mjs";

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

export function hasPersonalPlaceholder(html) {
  return hasMediaConsentPlaceholder(html) || hasCarnegieLinkPlaceholder(html);
}

// Lookups for the {{media_consent}} (#162) and {{carnegie_link}} (#200) blocks: every active
// student linked to each guardian email (dedupe keeps one row per email, so siblings come from
// here), each active student's first name, and each active support link code. Reads only.
export async function loadMediaConsentContext(client = supabaseAdmin) {
  const byEmail = studentsByGuardianEmail(await activeGuardianLinks(client));
  const ids = [...new Set([...byEmail.values()].flat(), ...await allStudentIds(client))];
  const names = new Map();
  const codes = new Map();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const [{ data, error }, { data: links, error: linkError }] = await Promise.all([
      client.from("portal_students").select("id, preferred_first, legal_first, display_name").in("id", chunk),
      client.from("sponsor_student_links").select("portal_student_id, code, active").in("portal_student_id", chunk),
    ]);
    if (error) throw new Error(error.message);
    if (linkError) throw new Error(linkError.message);
    for (const row of data || []) names.set(row.id, studentFirstName(row));
    for (const link of links || []) if (link.active) codes.set(link.portal_student_id, link.code);
  }
  return { byEmail, names, codes };
}

// Guardian rows carry person_id; student self rows do not. A student recipient's own record is
// their linked student for {{carnegie_link}}; they get no consent links.
export function personalizeForRecipient(bodyHtml, row, context, baseUrl = SITE_ORIGIN) {
  const kind = row.person_id ? "guardian" : "student";
  const linked = (kind === "guardian" ? context.byEmail.get(String(row.email).trim().toLowerCase()) || [] : [row.student_id])
    .filter((id) => context.names.has(id))
    .map((id) => ({ id, firstName: context.names.get(id) }))
    .sort((a, b) => a.firstName.localeCompare(b.firstName));
  const blocks = [];
  let students = [];
  if (hasMediaConsentPlaceholder(bodyHtml)) {
    students = kind === "guardian" ? linked.map(({ id, firstName }) => ({ firstName, token: mediaConsentToken(id) })) : [];
    blocks.push([MEDIA_CONSENT_RE, mediaConsentRecipientBlock(kind, students, baseUrl)]);
  }
  if (hasCarnegieLinkPlaceholder(bodyHtml)) {
    const cards = linked.map(({ id, firstName }) => ({ firstName, code: context.codes?.get(id) || null }));
    blocks.push([CARNEGIE_LINK_RE, carnegieLinkBlock(cards, baseUrl)]);
  }
  return { kind, students, ...fillPlaceholders(bodyHtml, blocks, htmlToText) };
}

// Send all not-yet-sent recipients for a broadcast. Resumable: only touches
// rows still 'queued' or 'failed', so re-running after a timeout finishes the job.
// Returns { sent, failed, skipped, remaining }.
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

  const mediaContext = hasPersonalPlaceholder(broadcast.body_html) && (pending || []).length
    ? await loadMediaConsentContext()
    : null;

  let sent = 0;
  let failed = 0;
  let skipped = 0;

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
      const update = sendFailureUpdate(err);
      await supabaseAdmin
        .from("broadcast_recipients")
        .update(update)
        .eq("id", row.id);
      if (update.send_status === "skipped") skipped += 1;
      else failed += 1;
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

  return { sent, failed, skipped, remaining: remaining || 0 };
}
