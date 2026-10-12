import { carnegieCardPath, carnegieLinkPreview, carnegieStudentFullUrl, carnegieStudentReadableUrl } from "./carnegieLetters.mjs";

// Per-student Carnegie link in a broadcast (#200). A body may contain {{carnegie_link}}; dispatch
// replaces it per recipient with one block per linked active student: the save-to-Photos card
// image and a button to that student's support page. Modeled on {{media_consent}} (#162).

export const CARNEGIE_LINK_PLACEHOLDER = "{{carnegie_link}}";
export const CARNEGIE_LINK_RE = /<p>\s*\{\{carnegie_link\}\}\s*<\/p>|\{\{carnegie_link\}\}/g;
export const CARNEGIE_LINK_FALLBACK = "If you do not see a Carnegie link for your student here, reply to this email and Mr. Parker will send it.";

const CARD_WIDTH = 300;
const CARD_HEIGHT = 375; // card PNG is 1080 x 1350
const BUTTON = "display:inline-block;padding:12px 20px;margin:8px 0;border-radius:6px;font-weight:bold;text-decoration:none;background:#7a1f2b;color:#ffffff;";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function hasCarnegieLinkPlaceholder(html) {
  return String(html || "").includes(CARNEGIE_LINK_PLACEHOLDER);
}

// students: [{ firstName, code }]. A student with no code gets the fallback line, never an image.
export function carnegieLinkBlock(students, baseUrl) {
  const base = String(baseUrl).replace(/\/+$/, "");
  const linked = students.filter((student) => student.code);
  const html = [];
  const text = [];
  for (const { firstName, code } of linked) {
    const { title } = carnegieLinkPreview(firstName);
    const url = escapeHtml(carnegieStudentFullUrl(code));
    const card = escapeHtml(`${base}${carnegieCardPath(code)}`);
    const name = escapeHtml(firstName);
    html.push(
      `<div style="margin:16px 0;padding:16px;border:1px solid #d8cfc0;border-radius:8px;text-align:center;">`
        + `<p style="margin:0 0 10px;"><strong>${escapeHtml(title)}</strong></p>`
        + `<a href="${url}"><img src="${card}" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" alt="${escapeHtml(`${title}. QR code for ${carnegieStudentReadableUrl(code)}`)}" style="display:block;margin:0 auto;width:${CARD_WIDTH}px;max-width:100%;height:auto;border:0;"></a>`
        + `<p style="margin:10px 0 0;font-size:14px;">Press and hold the picture to save it to your phone.</p>`
        + `<a href="${url}" style="${BUTTON}">Open ${name}&#39;s Carnegie page</a>`
        + `<p style="margin:0;font-size:14px;"><a href="${url}">${escapeHtml(carnegieStudentReadableUrl(code))}</a></p>`
        + `</div>`
    );
    text.push(`${title}\n${carnegieStudentFullUrl(code)}\nQR card to save: ${base}${carnegieCardPath(code)}`);
  }
  if (linked.length < students.length || !students.length) {
    html.push(`<p>${escapeHtml(CARNEGIE_LINK_FALLBACK)}</p>`);
    text.push(CARNEGIE_LINK_FALLBACK);
  }
  return { html: html.join("\n"), text: text.join("\n\n") };
}
