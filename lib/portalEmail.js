import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.PORTAL_EMAIL_FROM || "Ashley Bands <portal@director.ashleybands.com>";
const reviewTo = process.env.PORTAL_REVIEW_TO || "robert.parker@nhcs.net";

let resendClient;

function getResendClient() {
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }
  if (!resendClient) resendClient = new Resend(resendApiKey);
  return resendClient;
}

export function getPortalEmailConfig() {
  return {
    configured: Boolean(resendApiKey),
    fromAddress,
    reviewTo
  };
}

export async function sendPortalCodeEmail({ to, code, expiresMinutes = 15 }) {
  if (!to || !code) throw new Error("Portal code email requires to and code.");

  // Deliberately NO link in this email. A 6-digit code is inert — Microsoft Safe
  // Links has nothing to detonate, so it can't burn a single-use token before the
  // family reads it. The human reads the digits and types them on the page.
  return sendPortalEmail({
    to,
    subject: "Your Ashley Bands sign-in code",
    text: [
      "Your Ashley Bands sign-in code is:",
      "",
      code,
      "",
      `Enter it on the page where you requested it. This code expires in ${expiresMinutes} minutes.`,
      "",
      "If you did not request this, you can ignore this email."
    ].join("\n"),
    html: [
      "<p>Your Ashley Bands sign-in code is:</p>",
      `<p style="font-size:32px;font-weight:700;letter-spacing:6px;font-family:monospace;margin:12px 0">${escapeHtml(code)}</p>`,
      `<p>Enter it on the page where you requested it. This code expires in ${expiresMinutes} minutes.</p>`,
      "<p>If you did not request this, you can ignore this email.</p>"
    ].join("")
  });
}

export async function sendPortalAccessGrantedEmail({ to, studentName, portalUrl = "https://ashleybands.com/portal" }) {
  if (!to || !studentName) throw new Error("Access-granted email requires to and studentName.");

  return sendPortalEmail({
    to,
    subject: `You're connected to ${studentName} on the Ashley Bands portal`,
    text: [
      `Your email is verified and your account is connected to ${studentName}.`,
      "",
      `Sign in any time at ${portalUrl} using this email address - a sign-in code will be sent to you.`,
      "",
      "If you did not request this, reply to this email."
    ].join("\n"),
    html: [
      `<p>Your email is verified and your account is connected to ${escapeHtml(studentName)}.</p>`,
      `<p>Sign in any time at <a href="${escapeAttribute(portalUrl)}">${escapeHtml(portalUrl)}</a> using this email address - a sign-in code will be sent to you.</p>`,
      "<p>If you did not request this, reply to this email.</p>"
    ].join("")
  });
}

export async function sendPortalReviewAlert({ subject, summary, reviewUrl, details = [] }) {
  if (!subject || !summary) throw new Error("Portal review alert requires subject and summary.");

  const lines = [
    summary,
    "",
    ...details.filter(Boolean),
    ...(reviewUrl ? ["", `Review: ${reviewUrl}`] : [])
  ];

  const htmlDetails = details
    .filter(Boolean)
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join("");

  return sendPortalEmail({
    to: reviewTo,
    subject,
    text: lines.join("\n"),
    html: [
      `<p>${escapeHtml(summary)}</p>`,
      htmlDetails ? `<ul>${htmlDetails}</ul>` : "",
      reviewUrl ? `<p><a href="${escapeAttribute(reviewUrl)}">Review request</a></p>` : ""
    ].join("")
  });
}

export async function sendFeePaymentReceiptEmail({ to, studentName, amount, method, invoiceId, balance, purpose = "band program fee" }) {
  if (!to) throw new Error("Receipt email requires a recipient.");

  const lines = [
    `Thank you — we received your payment of ${amount} for ${studentName}.`,
    "",
    `Payment method: ${method}`,
    `For: ${purpose}`,
    `Reference: ${invoiceId}`,
    ...(balance ? [`Remaining balance: ${balance}`] : []),
    "",
    "This is a receipt for a band program fee payment. Fees are not tax-deductible.",
    "(Charitable donations and sponsorships to the Ashley Band Boosters are handled separately.)",
    "",
    "Questions? Reply to this email."
  ];

  return sendPortalEmail({
    to,
    subject: `Ashley Bands payment receipt — ${studentName}`,
    text: lines.join("\n"),
    html: [
      `<p>Thank you — we received your payment of <strong>${escapeHtml(amount)}</strong> for ${escapeHtml(studentName)}.</p>`,
      `<p>Payment method: ${escapeHtml(method)}<br/>For: ${escapeHtml(purpose)}<br/>Reference: ${escapeHtml(invoiceId)}`,
      balance ? `<br/>Remaining balance: ${escapeHtml(balance)}` : "",
      "</p>",
      "<p style=\"color:#6f675a;font-size:13px\">This is a receipt for a band program fee payment. Fees are not tax-deductible. Charitable donations and sponsorships to the Ashley Band Boosters are handled separately.</p>",
      "<p>Questions? Reply to this email.</p>"
    ].join("")
  });
}

export async function sendBandReadySummaryEmail({ to, studentName, completed, stillNeeded, followUp, portalUrl = "https://ashleybands.com/portal/band-ready" }) {
  if (!to?.length || !studentName) throw new Error("Band Ready summary requires recipients and a student.");
  const completeItems = completed?.length ? completed : ["Family Portal connection confirmed"];
  const neededItems = stillNeeded?.length ? stillNeeded : ["Nothing. This student reported having the Day One supplies they need."];
  const followUpItems = followUp?.length ? followUp : ["No additional follow-up was selected."];
  const listText = (items) => items.map((item) => `- ${item}`).join("\n");
  const listHtml = (items) => `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;

  return sendPortalEmail({
    to,
    subject: `${studentName} is Band Ready: Open House summary`,
    text: [
      `Thanks for completing Band Ready for ${studentName}.`,
      "",
      "Completed:", listText(completeItems),
      "", "Still needed before the first day:", listText(neededItems),
      "", "Follow-up:", listText(followUpItems),
      "", `Review this checklist any time: ${portalUrl}`,
      "", "Questions? Reply to this email."
    ].join("\n"),
    html: [
      `<p>Thanks for completing Band Ready for <strong>${escapeHtml(studentName)}</strong>.</p>`,
      "<h2>Completed</h2>", listHtml(completeItems),
      "<h2>Still needed before the first day</h2>", listHtml(neededItems),
      "<h2>Follow-up</h2>", listHtml(followUpItems),
      `<p><a href="${escapeAttribute(portalUrl)}">Review the Band Ready checklist</a></p>`,
      "<p>Questions? Reply to this email.</p>"
    ].join("")
  });
}

// Generic one-recipient send for the broadcast layer. Reuses the same verified
// Resend sender/domain (independent of NHCS Google/Microsoft). The composer loops
// this per recipient so each gets its own status row. text falls back from html.
export async function sendBroadcastEmail({ to, subject, html, text, from, replyTo }) {
  if (!to || !subject) throw new Error("Broadcast email requires to and subject.");
  const data = await sendPortalEmail({
    to,
    subject,
    html: html || "",
    text: text || htmlToText(html || ""),
    from,
    replyTo
  });
  return data?.id || "";
}

function htmlToText(html) {
  return String(html)
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function sendPortalEmail({ to, subject, text, html, from, replyTo }) {
  const client = getResendClient();
  const { data, error } = await client.emails.send({
    from: from || fromAddress,
    to: Array.isArray(to) ? to : [to],
    subject,
    text,
    html,
    ...(replyTo ? { replyTo } : {})
  });
  if (error) {
    throw new Error(error.message || "Resend email failed.");
  }
  return data;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}
