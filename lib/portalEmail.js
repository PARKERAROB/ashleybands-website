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

export async function sendPortalMagicLinkEmail({ to, link, expiresMinutes = 30 }) {
  if (!to || !link) throw new Error("Portal magic-link email requires to and link.");

  return sendPortalEmail({
    to,
    subject: "Your Ashley Bands profile link",
    text: [
      "Use this secure link to open your Ashley Bands family profile:",
      "",
      link,
      "",
      `This link expires in ${expiresMinutes} minutes.`,
      "",
      "If you did not request this, you can ignore this email."
    ].join("\n"),
    html: [
      "<p>Use this secure link to open your Ashley Bands family profile:</p>",
      `<p><a href="${escapeAttribute(link)}">Open your profile</a></p>`,
      `<p>This link expires in ${expiresMinutes} minutes.</p>`,
      "<p>If you did not request this, you can ignore this email.</p>"
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

export async function sendFeePaymentReceiptEmail({ to, studentName, amount, method, invoiceId, balance }) {
  if (!to) throw new Error("Receipt email requires a recipient.");

  const lines = [
    `Thank you — we received your payment of ${amount} for ${studentName}.`,
    "",
    `Payment method: ${method}`,
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
      `<p>Payment method: ${escapeHtml(method)}<br/>Reference: ${escapeHtml(invoiceId)}`,
      balance ? `<br/>Remaining balance: ${escapeHtml(balance)}` : "",
      "</p>",
      "<p style=\"color:#6f675a;font-size:13px\">This is a receipt for a band program fee payment. Fees are not tax-deductible. Charitable donations and sponsorships to the Ashley Band Boosters are handled separately.</p>",
      "<p>Questions? Reply to this email.</p>"
    ].join("")
  });
}

// Generic one-recipient send for the broadcast layer. Reuses the same verified
// Resend sender/domain (independent of NHCS Google/Microsoft). The composer loops
// this per recipient so each gets its own status row. text falls back from html.
export async function sendBroadcastEmail({ to, subject, html, text }) {
  if (!to || !subject) throw new Error("Broadcast email requires to and subject.");
  const data = await sendPortalEmail({
    to,
    subject,
    html: html || "",
    text: text || htmlToText(html || "")
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

async function sendPortalEmail({ to, subject, text, html }) {
  const client = getResendClient();
  const { data, error } = await client.emails.send({
    from: fromAddress,
    to: Array.isArray(to) ? to : [to],
    subject,
    text,
    html
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
