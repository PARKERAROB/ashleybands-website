const SAFE_LINK_RE = /^(https:\/\/|\/)/i;

export function normalizeNewsletterEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function isValidNewsletterEmail(value) {
  const email = normalizeNewsletterEmail(value);
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function inlineMarkdown(value) {
  const source = String(value || "");
  const tokenRe = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let html = "";
  let lastIndex = 0;

  for (const match of source.matchAll(tokenRe)) {
    html += escapeHtml(source.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      html += `<strong>${escapeHtml(token.slice(2, -2))}</strong>`;
    } else if (token.startsWith("*")) {
      html += `<em>${escapeHtml(token.slice(1, -1))}</em>`;
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const label = link?.[1] || token;
      const href = link?.[2] || "";
      html += SAFE_LINK_RE.test(href)
        ? `<a href="${escapeHtml(href)}" style="color:#7b1829;font-weight:700">${escapeHtml(label)}</a>`
        : escapeHtml(label);
    }
    lastIndex = (match.index || 0) + token.length;
  }

  return html + escapeHtml(source.slice(lastIndex));
}

export function newsletterMarkdownToHtml(markdown) {
  const blocks = [];
  let paragraph = [];
  let list = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p style="margin:0 0 18px;line-height:1.65">${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      `<ul style="margin:0 0 22px;padding-left:22px">${list
        .map((item) => `<li style="margin:0 0 9px;line-height:1.55">${inlineMarkdown(item)}</li>`)
        .join("")}</ul>`
    );
    list = [];
  };

  for (const rawLine of String(markdown || "").replaceAll("\r", "").split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      list.push(line.slice(2));
      continue;
    }
    flushList();
    if (line.startsWith("### ")) {
      flushParagraph();
      blocks.push(`<h3 style="margin:26px 0 10px;color:#4f101c;font-size:18px">${inlineMarkdown(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      flushParagraph();
      blocks.push(`<h2 style="margin:30px 0 12px;color:#4f101c;font-size:22px;line-height:1.25">${inlineMarkdown(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      flushParagraph();
      blocks.push(`<h1 style="margin:0 0 18px;color:#4f101c;font-size:30px;line-height:1.15">${inlineMarkdown(line.slice(2))}</h1>`);
    } else {
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks.join("\n");
}

export function newsletterMarkdownToText(markdown) {
  return String(markdown || "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1: $2")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,3}\s+/gm, "")
    .trim();
}

export function renderNewsletterEmail({ issue, edition, unsubscribeUrl }) {
  const member = edition === "member";
  const markdown = member ? issue.member_markdown : issue.public_markdown;
  const subject = member ? issue.member_subject : issue.public_subject;
  const archiveUrl = `https://ashleybands.com/newsletter/${encodeURIComponent(issue.slug)}`;
  const editionLabel = member ? "Ashley Bands students and families" : "AshleyBands Weekly";
  const footerReason = member
    ? "You are receiving the member edition because this address is connected to a current Ashley Bands student."
    : "You are receiving the public edition because this address subscribed at AshleyBands.com.";
  const preheader = escapeHtml(issue.preview_text || "AshleyBands Weekly");

  const html = `<!doctype html>
<html><body style="margin:0;background:#f7f3e8;color:#191716;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f3e8"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fffaf0;border:1px solid #ded4bf;border-radius:14px;overflow:hidden">
<tr><td style="background:#4f101c;padding:28px 30px;color:#fffaf0">
<div style="color:#c5a028;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase">${escapeHtml(editionLabel)}</div>
<div style="margin-top:8px;font-family:Georgia,serif;font-size:32px;font-weight:700">AshleyBands Weekly</div>
<div style="margin-top:8px;color:#eadfca;font-size:14px">${escapeHtml(issue.title)}</div>
</td></tr>
<tr><td style="padding:30px;font-size:16px">${newsletterMarkdownToHtml(markdown)}</td></tr>
<tr><td style="border-top:1px solid #ded4bf;padding:22px 30px;color:#6f675a;font-size:12px;line-height:1.55">
<p style="margin:0 0 8px"><a href="${archiveUrl}" style="color:#7b1829;font-weight:700">Read the public issue on AshleyBands.com</a></p>
<p style="margin:0 0 8px">${escapeHtml(footerReason)}</p>
<p style="margin:0 0 8px">Eugene Ashley High School, 555 Halyburton Memorial Pkwy, Wilmington, NC 28412</p>
<p style="margin:0"><a href="${escapeHtml(unsubscribeUrl)}" style="color:#6f675a">Unsubscribe from AshleyBands Weekly</a>. Urgent program messages are managed separately.</p>
</td></tr></table>
</td></tr></table></body></html>`;

  const text = [
    "AshleyBands Weekly",
    issue.title,
    "",
    newsletterMarkdownToText(markdown),
    "",
    `Public issue: ${archiveUrl}`,
    footerReason,
    "Eugene Ashley High School, 555 Halyburton Memorial Pkwy, Wilmington, NC 28412",
    `Unsubscribe from AshleyBands Weekly: ${unsubscribeUrl}`,
    "Urgent program messages are managed separately."
  ].join("\n");

  return { subject, html, text };
}

export function newsletterBroadcastSetComplete(broadcasts) {
  return Boolean(broadcasts?.length) && broadcasts.every((broadcast) => broadcast.status === "sent");
}

export function splitNewsletterAudience({ memberRecipients, contacts }) {
  const contactByEmail = new Map(
    (contacts || []).map((contact) => [normalizeNewsletterEmail(contact.email), contact])
  );
  const member = [];
  const memberEmails = new Set();

  for (const recipient of memberRecipients || []) {
    const email = normalizeNewsletterEmail(recipient.email);
    if (!isValidNewsletterEmail(email) || memberEmails.has(email)) continue;
    const preference = contactByEmail.get(email);
    if (preference?.newsletter_opted_out) continue;
    memberEmails.add(email);
    member.push({ ...recipient, email, contact: preference || null });
  }

  const publicRecipients = [];
  for (const contact of contacts || []) {
    const email = normalizeNewsletterEmail(contact.email);
    if (
      !isValidNewsletterEmail(email) ||
      memberEmails.has(email) ||
      !contact.community_opt_in ||
      contact.newsletter_opted_out
    ) continue;
    publicRecipients.push({ email, contact });
  }

  return { member, public: publicRecipients };
}
