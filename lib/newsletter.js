import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAudience } from "@/lib/audience";
import { sendBroadcastEmail } from "@/lib/portalEmail";
import {
  isUuid,
  isValidNewsletterEmail,
  newsletterBroadcastSetComplete,
  normalizeNewsletterEmail,
  renderNewsletterEmail,
  splitNewsletterAudience
} from "@/lib/newsletterFormat.mjs";

const ISSUE_FIELDS = [
  "slug",
  "issue_date",
  "week_start",
  "week_end",
  "title",
  "preview_text",
  "public_subject",
  "member_subject",
  "public_markdown",
  "member_markdown",
  "review_notes"
];

const ISSUE_SELECT = [
  "id",
  ...ISSUE_FIELDS,
  "status",
  "published_at",
  "created_by",
  "updated_by",
  "created_at",
  "updated_at"
].join(", ");

function safeText(value, max) {
  return String(value || "").trim().slice(0, max);
}

function issuePayload(input, staffName) {
  const payload = {
    slug: safeText(input.slug, 80).toLowerCase(),
    issue_date: safeText(input.issue_date, 10),
    week_start: safeText(input.week_start, 10),
    week_end: safeText(input.week_end, 10),
    title: safeText(input.title, 180),
    preview_text: safeText(input.preview_text, 300),
    public_subject: safeText(input.public_subject, 180),
    member_subject: safeText(input.member_subject, 180),
    public_markdown: safeText(input.public_markdown, 30_000),
    member_markdown: safeText(input.member_markdown, 35_000),
    review_notes: safeText(input.review_notes, 5_000),
    updated_by: safeText(staffName, 160),
    updated_at: new Date().toISOString()
  };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.issue_date)) throw new Error("Issue date is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.week_start)) throw new Error("Week start is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.week_end)) throw new Error("Week end is required.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.slug)) throw new Error("Use a lowercase date or word slug.");
  if (!payload.title || !payload.public_subject || !payload.member_subject) throw new Error("Title and both subjects are required.");
  if (!payload.public_markdown || !payload.member_markdown) throw new Error("Both editions need content.");
  return payload;
}

export async function listPublishedNewsletterIssues(limit = 24) {
  try {
    const { data, error } = await supabaseAdmin
      .from("newsletter_issues")
      .select("slug, issue_date, week_start, week_end, title, preview_text, published_at")
      .eq("status", "published")
      .order("issue_date", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.warn("Newsletter archive unavailable", error?.message || error);
    return [];
  }
}

export async function getPublishedNewsletterIssue(slug) {
  try {
    const { data, error } = await supabaseAdmin
      .from("newsletter_issues")
      .select("slug, issue_date, week_start, week_end, title, preview_text, public_subject, public_markdown, published_at")
      .eq("slug", safeText(slug, 80))
      .eq("status", "published")
      .maybeSingle();
    if (error) throw error;
    return data || null;
  } catch (error) {
    console.warn("Newsletter issue unavailable", error?.message || error);
    return null;
  }
}

export async function listNewsletterAdmin() {
  const [{ data: issues, error: issueError }, { data: contacts, error: contactError }] = await Promise.all([
    supabaseAdmin.from("newsletter_issues").select(ISSUE_SELECT).order("issue_date", { ascending: false }).limit(60),
    supabaseAdmin.from("newsletter_contacts").select("community_opt_in, newsletter_opted_out")
  ]);
  if (issueError) throw new Error(issueError.message);
  if (contactError) throw new Error(contactError.message);
  const confirmed = (contacts || []).filter((row) => row.community_opt_in && !row.newsletter_opted_out).length;
  const optedOut = (contacts || []).filter((row) => row.newsletter_opted_out).length;
  return { issues: issues || [], subscriberCounts: { confirmed, optedOut } };
}

export async function saveNewsletterIssue(input, staffName) {
  const id = isUuid(input.id) ? input.id : null;
  if (id) {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("newsletter_issues")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (!existing) throw new Error("Newsletter issue not found.");
    if (existing.status !== "draft") throw new Error("Published newsletter issues are immutable. Start a new issue instead.");
  }

  const payload = issuePayload(input, staffName);
  if (!id) payload.created_by = safeText(staffName, 160);

  const query = id
    ? supabaseAdmin.from("newsletter_issues").update(payload).eq("id", id)
    : supabaseAdmin.from("newsletter_issues").insert(payload);
  const { data, error } = await query.select(ISSUE_SELECT).single();
  if (error) throw new Error(error.message);
  return data;
}

async function loadNewsletterAudience() {
  const [{ recipients: memberRecipients }, { data: contacts, error }] = await Promise.all([
    resolveAudience({}, "both"),
    supabaseAdmin
      .from("newsletter_contacts")
      .select("id, email, community_opt_in, newsletter_opted_out, unsubscribe_token")
  ]);
  if (error) throw new Error(error.message);
  return {
    memberRecipients,
    contacts: contacts || [],
    split: splitNewsletterAudience({ memberRecipients, contacts: contacts || [] })
  };
}

export async function previewNewsletterAudience() {
  const { split } = await loadNewsletterAudience();
  return {
    memberCount: split.member.length,
    communityCount: split.public.length,
    totalCount: split.member.length + split.public.length
  };
}

export async function publishNewsletterIssue(issueId, staffName) {
  if (!isUuid(issueId)) throw new Error("Newsletter issue is required.");
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("newsletter_issues")
    .update({ status: "published", published_at: now, updated_at: now, updated_by: safeText(staffName, 160) })
    .eq("id", issueId)
    .eq("status", "draft")
    .select(ISSUE_SELECT)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Only a draft issue can be published.");
  return data;
}

async function ensureMemberContacts(memberRecipients, contacts) {
  const known = new Set((contacts || []).map((row) => normalizeNewsletterEmail(row.email)));
  const missing = [];
  for (const recipient of memberRecipients || []) {
    const email = normalizeNewsletterEmail(recipient.email);
    if (!isValidNewsletterEmail(email) || known.has(email)) continue;
    known.add(email);
    missing.push({
      email,
      source: "active_program",
      program_seen_at: new Date().toISOString()
    });
  }
  if (missing.length) {
    const { error } = await supabaseAdmin.from("newsletter_contacts").insert(missing);
    if (error) throw new Error(error.message);
  }

  const activeEmails = [...new Set((memberRecipients || []).map((row) => normalizeNewsletterEmail(row.email)).filter(isValidNewsletterEmail))];
  for (let i = 0; i < activeEmails.length; i += 200) {
    const { error } = await supabaseAdmin
      .from("newsletter_contacts")
      .update({ program_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .in("email", activeEmails.slice(i, i + 200));
    if (error) throw new Error(error.message);
  }
}

async function createEditionBroadcast({ issue, edition, recipients, createdBy }) {
  if (!recipients.length) return null;
  const subject = edition === "member" ? issue.member_subject : issue.public_subject;
  const markdown = edition === "member" ? issue.member_markdown : issue.public_markdown;
  const { data: broadcast, error } = await supabaseAdmin
    .from("broadcasts")
    .insert({
      subject,
      body_html: markdown,
      audience_filter: { newsletter: true, edition },
      recipient_axis: edition === "member" ? "both" : "guardians",
      status: "sending",
      created_by: safeText(createdBy, 160),
      recipient_count: recipients.length,
      newsletter_issue_id: issue.id,
      newsletter_edition: edition
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const rows = recipients.map((recipient) => ({
    broadcast_id: broadcast.id,
    student_id: recipient.student_id || null,
    person_id: recipient.person_id || null,
    email: normalizeNewsletterEmail(recipient.email),
    send_status: "queued"
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error: rowError } = await supabaseAdmin.from("broadcast_recipients").insert(rows.slice(i, i + 500));
    if (rowError) throw new Error(rowError.message);
  }
  return broadcast.id;
}

export async function createNewsletterBroadcasts(issueId, createdBy) {
  if (!isUuid(issueId)) throw new Error("Newsletter issue is required.");
  const { data: issue, error: issueError } = await supabaseAdmin
    .from("newsletter_issues")
    .select(ISSUE_SELECT)
    .eq("id", issueId)
    .eq("status", "published")
    .maybeSingle();
  if (issueError) throw new Error(issueError.message);
  if (!issue) throw new Error("Publish the newsletter archive before sending email.");

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("broadcasts")
    .select("id, newsletter_edition, status")
    .eq("newsletter_issue_id", issueId)
    .in("newsletter_edition", ["member", "public"]);
  if (existingError) throw new Error(existingError.message);
  if (newsletterBroadcastSetComplete(existing || [])) {
    throw new Error("This issue already has a completed newsletter send.");
  }
  if ((existing || []).length) {
    return {
      issue,
      broadcasts: Object.fromEntries(existing.map((row) => [row.newsletter_edition, row.id])),
      resumed: true
    };
  }

  const initial = await loadNewsletterAudience();
  await ensureMemberContacts(initial.memberRecipients, initial.contacts);
  const refreshed = await loadNewsletterAudience();
  const broadcasts = {};
  broadcasts.member = await createEditionBroadcast({
    issue,
    edition: "member",
    recipients: refreshed.split.member,
    createdBy
  });
  broadcasts.public = await createEditionBroadcast({
    issue,
    edition: "public",
    recipients: refreshed.split.public,
    createdBy
  });
  return { issue, broadcasts, resumed: false };
}

export async function dispatchNewsletterBroadcast(broadcastId) {
  if (!isUuid(broadcastId)) return { sent: 0, failed: 0, remaining: 0 };
  const { data: broadcast, error: broadcastError } = await supabaseAdmin
    .from("broadcasts")
    .select("id, subject, status, newsletter_edition, newsletter_issues!inner(id, slug, title, preview_text, public_subject, member_subject, public_markdown, member_markdown, status)")
    .eq("id", broadcastId)
    .maybeSingle();
  if (broadcastError) throw new Error(broadcastError.message);
  if (!broadcast || broadcast.newsletter_issues?.status !== "published") throw new Error("Published newsletter issue not found.");

  const { data: recipients, error: recipientError } = await supabaseAdmin
    .from("broadcast_recipients")
    .select("id, email")
    .eq("broadcast_id", broadcastId)
    .in("send_status", ["queued", "failed"]);
  if (recipientError) throw new Error(recipientError.message);

  const emails = (recipients || []).map((row) => normalizeNewsletterEmail(row.email));
  const contacts = [];
  for (let i = 0; i < emails.length; i += 200) {
    const { data, error } = await supabaseAdmin
      .from("newsletter_contacts")
      .select("email, newsletter_opted_out, unsubscribe_token")
      .in("email", emails.slice(i, i + 200));
    if (error) throw new Error(error.message);
    contacts.push(...(data || []));
  }
  const contactByEmail = new Map(contacts.map((row) => [normalizeNewsletterEmail(row.email), row]));

  let sent = 0;
  let failed = 0;
  for (const recipient of recipients || []) {
    const email = normalizeNewsletterEmail(recipient.email);
    const contact = contactByEmail.get(email);
    if (!contact || contact.newsletter_opted_out) {
      await supabaseAdmin
        .from("broadcast_recipients")
        .update({ send_status: "skipped", send_error: contact ? "newsletter_opted_out" : "newsletter_contact_missing" })
        .eq("id", recipient.id);
      continue;
    }
    try {
      const unsubscribeUrl = `https://ashleybands.com/newsletter/unsubscribe?token=${contact.unsubscribe_token}`;
      const rendered = renderNewsletterEmail({
        issue: broadcast.newsletter_issues,
        edition: broadcast.newsletter_edition,
        unsubscribeUrl
      });
      const resendId = await sendBroadcastEmail({
        to: email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text
      });
      await supabaseAdmin
        .from("broadcast_recipients")
        .update({ send_status: "sent", resend_id: resendId, send_error: "", sent_at: new Date().toISOString() })
        .eq("id", recipient.id);
      sent += 1;
    } catch (error) {
      await supabaseAdmin
        .from("broadcast_recipients")
        .update({ send_status: "failed", send_error: String(error?.message || error).slice(0, 500) })
        .eq("id", recipient.id);
      failed += 1;
    }
  }

  const { count: remaining } = await supabaseAdmin
    .from("broadcast_recipients")
    .select("id", { count: "exact", head: true })
    .eq("broadcast_id", broadcastId)
    .in("send_status", ["queued", "failed"]);
  const finalStatus = remaining ? "failed" : "sent";
  await supabaseAdmin
    .from("broadcasts")
    .update({ status: finalStatus, sent_at: finalStatus === "sent" ? new Date().toISOString() : null })
    .eq("id", broadcastId);
  return { sent, failed, remaining: remaining || 0 };
}

export async function requestCommunitySubscription(rawEmail) {
  const email = normalizeNewsletterEmail(rawEmail);
  if (!isValidNewsletterEmail(email)) throw new Error("Enter a valid email address.");
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("newsletter_contacts")
    .select("id, community_opt_in, newsletter_opted_out")
    .eq("email", email)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing?.community_opt_in && !existing.newsletter_opted_out) return { alreadySubscribed: true };

  const confirmToken = randomUUID();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const payload = {
    email,
    community_opt_in: false,
    confirm_token: confirmToken,
    confirm_expires_at: expires,
    source: "community_signup",
    updated_at: new Date().toISOString()
  };
  const { error } = existing
    ? await supabaseAdmin.from("newsletter_contacts").update(payload).eq("id", existing.id)
    : await supabaseAdmin.from("newsletter_contacts").insert(payload);
  if (error) throw new Error(error.message);

  const confirmUrl = `https://ashleybands.com/newsletter/confirm?token=${confirmToken}`;
  await sendBroadcastEmail({
    to: email,
    subject: "Confirm AshleyBands Weekly",
    text: [
      "Confirm your subscription to AshleyBands Weekly.",
      "",
      confirmUrl,
      "",
      "The page will ask you to confirm before the subscription becomes active.",
      "If you did not request this, you can ignore this email."
    ].join("\n"),
    html: [
      "<p>Confirm your subscription to <strong>AshleyBands Weekly</strong>.</p>",
      `<p><a href="${confirmUrl}" style="display:inline-block;background:#7b1829;color:#fffaf0;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Review and confirm</a></p>`,
      "<p>The page will ask you to confirm before the subscription becomes active.</p>",
      "<p style=\"color:#6f675a;font-size:13px\">If you did not request this, you can ignore this email.</p>"
    ].join("")
  });
  return { alreadySubscribed: false };
}

export async function confirmCommunitySubscription(token) {
  if (!isUuid(token)) return false;
  const { data: contact, error } = await supabaseAdmin
    .from("newsletter_contacts")
    .select("id, confirm_expires_at")
    .eq("confirm_token", token)
    .maybeSingle();
  const expiresAt = Date.parse(contact?.confirm_expires_at || "");
  if (error || !contact || !Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const now = new Date().toISOString();
  const { data: confirmed, error: updateError } = await supabaseAdmin
    .from("newsletter_contacts")
    .update({
      community_opt_in: true,
      newsletter_opted_out: false,
      opted_out_at: null,
      confirmed_at: now,
      confirm_token: null,
      confirm_expires_at: null,
      updated_at: now
    })
    .eq("id", contact.id)
    .eq("confirm_token", token)
    .select("id")
    .maybeSingle();
  return !updateError && Boolean(confirmed);
}

export async function unsubscribeNewsletter(token) {
  if (!isUuid(token)) return false;
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("newsletter_contacts")
    .update({
      community_opt_in: false,
      newsletter_opted_out: true,
      opted_out_at: now,
      updated_at: now
    })
    .eq("unsubscribe_token", token)
    .select("id")
    .maybeSingle();
  return !error && Boolean(data);
}
