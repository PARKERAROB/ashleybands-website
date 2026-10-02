import crypto from "node:crypto";

// Media interview permission (#162). A broadcast body may contain
// {{media_consent}}; dispatch replaces it per recipient. Guardians get a Yes/No
// link pair for each active band student linked to their email. Students get a
// line with no links. Answers live in media_consent_responses; latest wins.

export const MEDIA_CONSENT_PLACEHOLDER = "{{media_consent}}";
export const PREVIEW_TOKEN = "preview";
export const ANSWERS = new Set(["yes", "no"]);
export const MEDIA_CONSENT_FAMILY_ERROR =
  "We couldn't record your answer from this link. Please email Mr. Parker at robert.parker@nhcs.net and he will take care of it.";

const PLACEHOLDER_RE = /<p>\s*\{\{media_consent\}\}\s*<\/p>|\{\{media_consent\}\}/g;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIG_LENGTH = 22; // 132 bits of HMAC-SHA256

const STUDENT_LINE = "Your parent or guardian received a link to answer this.";
const NO_LINKS_LINE = "If you do not see a Yes or No link for your student, reply to this email and Mr. Parker will take care of it.";

function secret(value) {
  const key = value ?? process.env.PORTAL_SESSION_SECRET;
  if (!key) throw new Error("PORTAL_SESSION_SECRET is not configured.");
  return key;
}

function signature(studentId, key) {
  return crypto.createHmac("sha256", secret(key)).update(`media-consent:v1:${studentId}`).digest("base64url").slice(0, SIG_LENGTH);
}

export function mediaConsentToken(studentId, key) {
  return `${studentId}.${signature(String(studentId).toLowerCase(), key)}`;
}

// Returns the portal student id the token was issued for, or null.
export function verifyMediaConsentToken(token, key) {
  const [studentId, sig, extra] = String(token || "").split(".");
  if (extra !== undefined || !UUID_RE.test(studentId || "") || !sig || sig.length !== SIG_LENGTH) return null;
  const expected = signature(studentId.toLowerCase(), key);
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? studentId.toLowerCase() : null;
}

export function mediaConsentUrl(baseUrl, token, answer) {
  return `${String(baseUrl).replace(/\/+$/, "")}/media-consent?t=${encodeURIComponent(token)}&a=${answer}`;
}

export function studentFirstName(student = {}) {
  return String(student.preferred_first || student.legal_first || student.display_name || "").trim().split(/\s+/)[0] || "your student";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const BUTTON = "display:inline-block;padding:10px 18px;margin:4px 8px 4px 0;border-radius:6px;font-weight:bold;text-decoration:none;";

// students: [{ firstName, token }]. token PREVIEW_TOKEN makes non-recording links.
export function mediaConsentBlock(students, baseUrl) {
  if (!students.length) {
    return { html: `<p>${escapeHtml(NO_LINKS_LINE)}</p>`, text: NO_LINKS_LINE };
  }
  const html = [];
  const text = [];
  for (const { firstName, token } of students) {
    const name = escapeHtml(firstName);
    const yes = mediaConsentUrl(baseUrl, token, "yes");
    const no = mediaConsentUrl(baseUrl, token, "no");
    html.push(
      `<div style="margin:12px 0;padding:12px 16px;border:1px solid #d8cfc0;border-radius:8px;">`
        + `<p style="margin:0 0 6px;"><strong>${name}</strong></p>`
        + `<a href="${escapeHtml(yes)}" style="${BUTTON}background:#7a1f2b;color:#ffffff;">Yes, ${name} may be interviewed</a>`
        + `<a href="${escapeHtml(no)}" style="${BUTTON}background:#ffffff;color:#7a1f2b;border:1px solid #7a1f2b;">No interviews for ${name}</a>`
        + `</div>`
    );
    text.push(`${firstName}\nYes, ${firstName} may be interviewed: ${yes}\nNo interviews for ${firstName}: ${no}`);
  }
  return { html: html.join("\n"), text: text.join("\n\n") };
}

export function hasMediaConsentPlaceholder(html) {
  return String(html || "").includes(MEDIA_CONSENT_PLACEHOLDER);
}

// Replace the placeholder. kind: "guardian" | "student". Returns { html, text }
// where text keeps link URLs (the HTML-to-text fallback would drop them).
export function personalizeMediaConsent(bodyHtml, { kind, students = [], baseUrl }, htmlToText) {
  const block = kind === "guardian"
    ? mediaConsentBlock(students, baseUrl)
    : { html: `<p><em>${escapeHtml(STUDENT_LINE)}</em></p>`, text: STUDENT_LINE };
  const html = String(bodyHtml).replace(PLACEHOLDER_RE, block.html);
  const marker = "MEDIACONSENTTEXTBLOCK";
  const text = htmlToText(String(bodyHtml).replace(PLACEHOLDER_RE, `<p>${marker}</p>`)).replace(marker, block.text);
  return { html, text };
}

// links: [{ student_id, email }] guardian rows before dedupe (one per student
// per email). Returns Map(lowercased email -> [student_id]).
export function studentsByGuardianEmail(links) {
  const map = new Map();
  for (const { student_id: studentId, email } of links || []) {
    if (!studentId || !email) continue;
    const key = email.trim().toLowerCase();
    const list = map.get(key) || [];
    if (!list.includes(studentId)) list.push(studentId);
    map.set(key, list);
  }
  return map;
}

// rows: [{ student_id, answer, created_at }] -> Map(student_id -> { answer, at }).
export function latestAnswers(rows) {
  const latest = new Map();
  for (const row of rows || []) {
    const current = latest.get(row.student_id);
    if (!current || String(row.created_at) > String(current.at)) {
      latest.set(row.student_id, { answer: row.answer, at: row.created_at });
    }
  }
  return latest;
}

// Mail scanners and link previewers sometimes open links. Never record for them.
export function isAutomatedAgent(userAgent) {
  return !userAgent || /bot|crawl|spider|headless|preview|scan|python|curl|wget|safelinks|proofpoint|mimecast|barracuda/i.test(userAgent);
}
