// Carnegie student letters, path A "family and friends" (#106).
//
// Pure rules shared by the Family Portal, the staff review queue, the printable packet and the
// donor landing: the music-note chart, letter states, the approved letter text and the gate.
// Student credit is record-keeping only (#103): no balance, nothing a student can use as money.

import { SPONSOR_CONTACT } from "./sponsorshipContent.js";

// ---- Gate -----------------------------------------------------------------------------------
// OFF unless CARNEGIE_LETTERS_MODE is set. "staff" shows the new surfaces only to requests that
// also carry a valid staff session. "on" is the family release and is the director's decision.
export const CARNEGIE_LETTERS_MODES = Object.freeze(["off", "staff", "on"]);
export function carnegieLettersMode(env = process.env) {
  const value = String(env?.CARNEGIE_LETTERS_MODE || "").trim().toLowerCase();
  return value === "staff" || value === "on" ? value : "off";
}

// ---- Wording (director rules, 2026-09-24) ---------------------------------------------------
export const NOTES_GOAL_CENTS = 50_000;
export const TRIP_ESTIMATE_LINE = "Estimated trip cost: $2,500 per student. Everything the band raises brings that down for everyone.";
export const NOTES_FILLED_LINE = "You filled your notes! Keep going: every extra note helps a bandmate get there.";
export const NOTES_FILL_HINT = "Notes fill in when a gift is confirmed.";
export const CAMPAIGN_GIFT_LINE = "Every gift goes to the band's Carnegie campaign and lowers the trip cost for every student who goes.";
export const PUBLIC_SITE = "ashleybands.com";
// Director copy, 2026-09-24, written as two sentences for the site's no-em-dash voice rule.
// Names no employer or platform and promises nothing about eligibility.
export const EMPLOYER_MATCH_LINE = "Does your employer match gifts? Ask HR. It could double your gift.";
// Words that must never describe a student's notes or trip (director rule).
export const FORBIDDEN_STUDENT_WORDS = Object.freeze([/\bfunded\b/i, /\bbalance\b/i, /\baccount\b/i, /credited to (your|my|their|one student's) trip cost/i]);

export function studentFirstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

export function carnegieStudentPath(code) {
  return `/support/${code}/carnegie`;
}

export function carnegieStudentReadableUrl(code) {
  return `${PUBLIC_SITE}${carnegieStudentPath(code)}`;
}

export function carnegieCheckMemo(firstName) {
  const name = studentFirstName(firstName);
  return name ? `Carnegie · ${name}` : "Carnegie";
}

// Director decision, 2026-09-24 (#111): one payee name across the site.
export const CARNEGIE_CHECK_PAYEE = SPONSOR_CONTACT.boosterOrg;

export function notesStatusLine(notesCents) {
  return Number(notesCents || 0) >= NOTES_GOAL_CENTS ? NOTES_FILLED_LINE : NOTES_FILL_HINT;
}

// ---- Music-note chart -----------------------------------------------------------------------
// Two beamed eighth notes, as in the approved chart. 62 squares: $260 in the two note heads and
// $240 in the stems and beams, $500 in all. The order is fixed: left head (top row first), left
// stem (bottom up), lower beam, upper beam, right stem (top down), right head.
const HEAD_ROWS = Object.freeze([[5, 5, 5], [10, 10, 10, 10, 10], [10, 10, 10, 10, 10], [5, 5, 5]]);
export const NOTES_CHART_GEOMETRY = Object.freeze({
  width: 720,
  height: 560,
  staffLines: [176, 216, 256, 296, 336],
  beam: { x: 216, y: 30, width: 494, height: 110, skewDeg: -3 },
  stems: [{ x: 222, y: 122, width: 60, height: 296 }, { x: 638, y: 100, width: 60, height: 272 }],
  heads: [{ id: "headL", cx: 146, cy: 458 }, { id: "headR", cx: 571, cy: 420 }],
  headRadius: { rx: 135, ry: 88 },
  headRotateDeg: -18,
  barCell: { width: 50, height: 38 },
  headCell: { width: 44, height: 34, gap: 4 }
});

function headCells(head) {
  const { width, height, gap } = NOTES_CHART_GEOMETRY.headCell;
  const totalHeight = HEAD_ROWS.length * height + (HEAD_ROWS.length - 1) * gap;
  const cells = [];
  HEAD_ROWS.forEach((row, r) => {
    const rowWidth = row.length * width + (row.length - 1) * gap;
    row.forEach((value, c) => {
      cells.push({
        group: head.id,
        value,
        x: head.cx - rowWidth / 2 + c * (width + gap),
        y: head.cy - totalHeight / 2 + r * (height + gap),
        width,
        height
      });
    });
  });
  return cells;
}

function barCells() {
  const { width, height } = NOTES_CHART_GEOMETRY.barCell;
  const cells = [];
  for (let i = 0; i < 6; i += 1) cells.push({ group: "stemL", value: 10, x: 226, y: 362 - i * 42 });
  for (let col = 0; col < 9; col += 1) cells.push({ group: "beamLow", value: 10, x: 224 + col * 53, y: Math.round(88 - col * 2.8) });
  for (let col = 0; col < 9; col += 1) cells.push({ group: "beamHigh", value: 5, x: 224 + col * 53, y: Math.round(44 - col * 2.8) });
  for (let i = 0; i < 6; i += 1) cells.push({ group: "stemR", value: i < 3 ? 5 : 10, x: 642, y: 110 + i * 42 });
  return cells.map((cell) => ({ ...cell, width, height }));
}

const CHART_ORDER = Object.freeze([
  ...headCells(NOTES_CHART_GEOMETRY.heads[0]),
  ...barCells(),
  ...headCells(NOTES_CHART_GEOMETRY.heads[1])
].map((cell, index) => Object.freeze({ ...cell, index })));

// Fill rule: walk the fixed order; a square fills when the running filled total plus its value
// stays within the confirmed amount. A $10 square that does not fit is skipped and a later $5
// square may still fill. At $500 or more every square is filled.
// Reported gifts that staff have not confirmed never fill a square. They may be shown in a
// separate pending state on the squares that remain, by the same rule, and count nowhere.
export function notesChartSquares(confirmedCents = 0, pendingCents = 0) {
  const target = Math.max(0, Math.floor(Number(confirmedCents) || 0));
  const pendingTarget = Math.max(0, Math.floor(Number(pendingCents) || 0));
  let running = 0;
  const squares = CHART_ORDER.map((cell) => {
    const cents = cell.value * 100;
    const filled = running + cents <= target;
    if (filled) running += cents;
    return { ...cell, filled, state: filled ? "filled" : "empty" };
  });
  let pendingRunning = 0;
  for (const square of squares) {
    if (square.filled) continue;
    const cents = square.value * 100;
    if (pendingRunning + cents <= pendingTarget) {
      pendingRunning += cents;
      square.state = "pending";
    }
  }
  return squares;
}

export function notesChartSummary(confirmedCents = 0, pendingCents = 0) {
  const squares = notesChartSquares(confirmedCents, pendingCents);
  const filled = squares.filter((square) => square.filled);
  return {
    squares,
    total: squares.length,
    filledCount: filled.length,
    pendingCount: squares.filter((square) => square.state === "pending").length,
    filledCents: filled.reduce((sum, square) => sum + square.value * 100, 0),
    complete: Number(confirmedCents || 0) >= NOTES_GOAL_CENTS
  };
}

// ---- Letters --------------------------------------------------------------------------------
export const LETTER_TEMPLATE_VERSION = "path-a-2026-09-24-v1";
export const LETTER_LIMITS = Object.freeze({ recipientName: 80, meaning: 1500, help: 1000 });

export const RECIPIENT_TYPES = Object.freeze([
  { value: "someone_i_know", label: "Someone I know", hint: "Family, a family friend, a neighbor or a teacher.", enabled: true },
  { value: "general_supporter", label: "General supporter", hint: "A letter you can hand to anyone. It opens with \"Dear Friend.\"", enabled: true },
  { value: "business", label: "A business", hint: "Coming later.", enabled: false },
  { value: "organization", label: "A club or organization", hint: "Coming later.", enabled: false }
]);
const ENABLED_RECIPIENT_TYPES = new Set(RECIPIENT_TYPES.filter((type) => type.enabled).map((type) => type.value));

export const LETTER_PROMPTS = Object.freeze({
  meaning: "What has band at Ashley meant to you?",
  help: "Why would you love this person's help?"
});

export const LETTER_STATUSES = Object.freeze(["draft", "needs_review", "approved", "printed", "delivery_reported"]);
export const LETTER_STATUS_LABELS = Object.freeze({
  draft: "Draft",
  needs_review: "Needs review",
  approved: "Approved for print",
  printed: "Printed",
  delivery_reported: "Delivery reported"
});
export const APPROVED_STATUSES = Object.freeze(["approved", "printed", "delivery_reported"]);

export function recipientTypeLabel(value) {
  return RECIPIENT_TYPES.find((type) => type.value === value)?.label || "Letter";
}

// The student's words are stored exactly as typed. Nothing here trims, rewrites or truncates
// them; input that is too long is refused instead.
export function validateLetterContent(input = {}, { requireComplete = false } = {}) {
  const recipientType = String(input.recipient_type || "");
  if (!ENABLED_RECIPIENT_TYPES.has(recipientType)) throw new Error("Choose who you are writing to.");
  const recipientName = typeof input.recipient_name === "string" ? input.recipient_name : "";
  const recipientEmail = String(input.recipient_email || "").trim().toLowerCase();
  if (recipientEmail && (recipientEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail))) throw new Error("Enter a valid email for them, or leave it blank.");
  const meaningText = typeof input.meaning_text === "string" ? input.meaning_text : "";
  const helpText = typeof input.help_text === "string" ? input.help_text : "";
  if (recipientName.length > LETTER_LIMITS.recipientName) throw new Error(`Keep the name under ${LETTER_LIMITS.recipientName} characters.`);
  if (meaningText.length > LETTER_LIMITS.meaning) throw new Error(`Keep the first answer under ${LETTER_LIMITS.meaning} characters.`);
  if (helpText.length > LETTER_LIMITS.help) throw new Error(`Keep the second answer under ${LETTER_LIMITS.help} characters.`);
  if (requireComplete) {
    if (recipientType === "someone_i_know" && !recipientName.trim()) throw new Error("Add the name of the person you are writing to.");
    if (!meaningText.trim()) throw new Error(`Answer "${LETTER_PROMPTS.meaning}"`);
    if (!helpText.trim()) throw new Error(`Answer "${LETTER_PROMPTS.help}"`);
  }
  return {
    recipient_type: recipientType,
    recipient_name: recipientType === "general_supporter" ? "" : recipientName,
    recipient_email: recipientType === "general_supporter" ? "" : recipientEmail,
    meaning_text: meaningText,
    help_text: helpText
  };
}

export function letterContentChanged(before = {}, after = {}) {
  return ["recipient_type", "recipient_name", "meaning_text", "help_text"].some((key) => (before[key] ?? "") !== (after[key] ?? ""));
}

// Status rules. Families write on the student's behalf under the adult portal sign-in; staff
// review. Staff never edit the student's words. Returns the next status, or throws.
const TRANSITIONS = Object.freeze({
  submit: { actors: ["family"], from: ["draft"], to: "needs_review" },
  approve: { actors: ["staff"], from: ["needs_review"], to: "approved" },
  return_to_draft: { actors: ["staff"], from: ["needs_review"], to: "draft" },
  mark_printed: { actors: ["family", "staff"], from: ["approved"], to: "printed" },
  // Reported by a person, never automatic: "I sent it by email / text / paper".
  report_delivery: { actors: ["family", "staff"], from: ["approved", "printed"], to: "delivery_reported" }
});
export const LETTER_ACTIONS = Object.freeze(Object.keys(TRANSITIONS));

export function nextLetterStatus(status, action, actorType) {
  const rule = TRANSITIONS[action];
  if (!rule) throw new Error("Unknown letter action.");
  if (!rule.actors.includes(actorType)) throw new Error("That step is not available here.");
  if (!rule.from.includes(status)) throw new Error(`A letter that is ${LETTER_STATUS_LABELS[status] || status} cannot do that.`);
  return rule.to;
}

// Editing the words, recipient or type. An edit after approval returns the letter to review and
// the earlier approval no longer applies. A reported delivery is final.
export function statusAfterEdit(status) {
  if (status === "delivery_reported") throw new Error("This letter was delivered and can no longer change. Start a new letter instead.");
  if (status === "approved" || status === "printed") return "needs_review";
  return status;
}

export const DELIVERY_CHANNELS = Object.freeze(["paper", "email", "text"]);
export function deliveryChannel(value) {
  const channel = String(value || "");
  return DELIVERY_CHANNELS.includes(channel) ? channel : null;
}

export function letterIsPrintable(letter) {
  return Boolean(letter && ["approved", "printed", "delivery_reported"].includes(letter.status) && letter.approved_version === letter.version);
}

// The whole letter, from the approved template plus the student's own words.
export function composeCarnegieLetter({ recipientType, recipientName, meaningText, helpText, firstName, code }) {
  const name = studentFirstName(firstName) || "An Ashley band student";
  const greetingName = recipientType === "general_supporter" ? "Friend" : String(recipientName || "").trim() || "[name]";
  return {
    greeting: `Dear ${greetingName},`,
    opening: "Our Wind Ensemble and Concert Band have been selected to perform at Carnegie Hall in New York on March 25, 2027. Our band community is raising money together so every student who goes pays less.",
    ownWordsLabel: "In my own words",
    meaning: meaningText || "",
    help: helpText || "",
    ask: "Would you help me fill my music notes? My part of the team goal is $500, and every $5 or $10 note makes a difference. Every gift goes to the band's Carnegie campaign and lowers the trip cost for all of us.",
    closing: "Scan the code on the back, or visit the link below. Thank you for helping us get there.",
    signoff: "With appreciation,",
    signature: name,
    url: code ? carnegieStudentReadableUrl(code) : `${PUBLIC_SITE}/support/[your link]/carnegie`,
    payLine: `Give online, or write a check to ${CARNEGIE_CHECK_PAYEE} with "${carnegieCheckMemo(name)}" in the memo.`,
    campaignLine: CAMPAIGN_GIFT_LINE
  };
}

// ---- Student-reported offline gifts (director scope addition, 2026-09-24) ------------------
// A family reports cash or a check the student collected. It is unverified: it is not a gift,
// counts in no total, and sends no receipt until staff confirm it through the #103 offline path.
export const REPORTED_GIFT_METHODS = Object.freeze(["cash", "check"]);
export const REPORTED_GIFT_MIN_CENTS = 100;
export const REPORTED_GIFT_MAX_CENTS = 5_000_000;
export const REPORTED_GIFT_ENVELOPE_LINE = "Seal the cash or check in an envelope with the gift slip and put it in the band-room box.";
export const GIFT_SLIP_LINE = "Seal cash or check with this slip in an envelope and turn it in at the band room.";
export const REPORTED_GIFT_STATUS_LABELS = Object.freeze({
  reported: "Waiting for staff to confirm",
  confirmed: "Confirmed",
  rejected: "Not confirmed; see Mr. Parker."
});

function dollarsText(cents) {
  const value = (Number(cents) || 0) / 100;
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

export function pendingNotesLine(pendingCents) {
  return Number(pendingCents || 0) > 0 ? `${dollarsText(pendingCents)} waiting for staff to confirm.` : "";
}

export function parseDollarsToCents(value) {
  const text = String(value ?? "").trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  return Math.round(Number(text) * 100);
}

function reportedAmountCents(input) {
  const cents = input.amount_cents != null && input.amount_cents !== "" ? Math.round(Number(input.amount_cents)) : parseDollarsToCents(input.amount);
  if (!Number.isInteger(cents) || cents < REPORTED_GIFT_MIN_CENTS) throw new Error("Enter an amount of at least $1.");
  if (cents > REPORTED_GIFT_MAX_CENTS) throw new Error("For gifts over $50,000, please contact Mr. Parker directly.");
  return cents;
}

export function validateReportedGift(input = {}) {
  const donorName = String(input.donor_name || "").trim();
  if (!donorName) throw new Error("Enter the name of the person who gave the gift.");
  if (donorName.length > 160) throw new Error("Keep the donor name under 160 characters.");
  const method = String(input.method || "");
  if (!REPORTED_GIFT_METHODS.includes(method)) throw new Error("Choose cash or check.");
  const donorEmail = String(input.donor_email || "").trim().toLowerCase();
  if (donorEmail && (donorEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donorEmail))) throw new Error("Enter a valid email for the receipt, or leave it blank.");
  const checkNumber = method === "check" ? String(input.check_number || "").trim() : "";
  if (checkNumber.length > 40) throw new Error("Keep the check number under 40 characters.");
  const note = String(input.note || "").trim();
  if (note.length > 500) throw new Error("Keep the note under 500 characters.");
  return {
    donor_name: donorName,
    donor_email: donorEmail,
    reported_amount_cents: reportedAmountCents(input),
    reported_method: method,
    check_number: checkNumber,
    note
  };
}

// Only confirmed gifts count. Reported gifts that are waiting show as pending, and nothing else.
export function pendingReportedCents(reports = []) {
  return reports.filter((report) => report?.status === "reported").reduce((sum, report) => sum + Number(report.reported_amount_cents || 0), 0);
}

// Staff confirmation: as reported by default, or with an adjusted amount or method.
export function confirmationFromReview(report, body = {}) {
  if (report?.status !== "reported") throw new Error("This report was already reviewed.");
  const adjusted = body.amount != null && body.amount !== "" || body.amount_cents != null && body.amount_cents !== "";
  const amountCents = adjusted ? reportedAmountCents(body) : report.reported_amount_cents;
  const method = body.method ? String(body.method) : report.reported_method;
  if (!REPORTED_GIFT_METHODS.includes(method)) throw new Error("Choose cash or check.");
  return { amountCents, method, adjusted: amountCents !== report.reported_amount_cents || method !== report.reported_method };
}

export function rejectionReason(body = {}) {
  const reason = String(body.reason || "").trim();
  if (!reason) throw new Error("Add a short reason so the family knows why.");
  if (reason.length > 500) throw new Error("Keep the reason under 500 characters.");
  return reason;
}

// ---- Sharing from the family's own device (director scope addition, 2026-09-24) -----------
// The website never sends email or texts. It builds a mailto: link, a share sheet or sms: link,
// and copy text; the student or family sends from their own device.
export const LETTER_EMAIL_SUBJECT = "Help me get to Carnegie Hall";
export const MAILTO_MAX_LENGTH = 1800;

export function carnegieStudentUrl(code) {
  return `https://${PUBLIC_SITE}${carnegieStudentPath(code)}`;
}

// The short, fixed text message. Its wording is fixed, so it needs no review.
export function carnegieShareText(code) {
  return `I'm helping our band get to Carnegie Hall! Would you fill a music note for me? ${carnegieStudentUrl(code)}`;
}

export function smsHref(text) {
  return `sms:?&body=${encodeURIComponent(text)}`;
}

// The approved letter as plain text for email: same template and the student's exact words,
// with the paper-only line about the back page replaced by the link.
export function letterPlainText(letter, { firstName, code }) {
  const text = composeCarnegieLetter({
    recipientType: letter.recipient_type,
    recipientName: letter.recipient_name,
    meaningText: letter.meaning_text,
    helpText: letter.help_text,
    firstName,
    code
  });
  return [
    text.greeting,
    text.opening,
    text.meaning,
    text.help,
    text.ask,
    "Thank you for helping us get there.",
    `${text.signoff}\n${text.signature}`,
    `${text.payLine} ${text.campaignLine}`,
    EMPLOYER_MATCH_LINE,
    `You can give online at my link: ${carnegieStudentUrl(code)}`
  ].filter((part) => String(part || "").length).join("\n\n");
}

export function letterMailto(letter, { firstName, code }) {
  const to = letter.recipient_type === "someone_i_know" ? String(letter.recipient_email || "") : "";
  const full = letterPlainText(letter, { firstName, code });
  const build = (body) => `mailto:${encodeURIComponent(to).replace(/%40/g, "@")}?subject=${encodeURIComponent(LETTER_EMAIL_SUBJECT)}&body=${encodeURIComponent(body)}`;
  const href = build(full);
  if (href.length <= MAILTO_MAX_LENGTH) return { href, fits: true, text: full };
  const greeting = composeCarnegieLetter({ recipientType: letter.recipient_type, recipientName: letter.recipient_name, firstName, code }).greeting;
  return { href: build(`${greeting}\n\n[Paste the letter you copied here.]\n\n${carnegieStudentUrl(code)}`), fits: false, text: full };
}

// Which send actions a letter shows. Email and print need staff approval of this exact version.
export function letterSendActions(letter) {
  if (!letterIsPrintable(letter)) return [];
  const actions = ["email", "text", "print"];
  if (letter.status === "approved" || letter.status === "printed") actions.push("report_sent");
  return actions;
}

// Link preview for /support/{code}/carnegie: first name only, no amounts, no private data.
export function carnegieLinkPreview(firstName) {
  const name = studentFirstName(firstName);
  const title = name ? `Help ${name} get to Carnegie Hall` : "Help Ashley Bands get to Carnegie Hall";
  const description = `Fill a music note for ${name || "an Ashley band student"}. ${CAMPAIGN_GIFT_LINE}`;
  return { title, description, siteName: "Ashley Bands", imageAlt: "Fill my Music Notes: Ashley Bands to Carnegie Hall" };
}

// Plain SVG markup of the chart, for places that cannot render React (the link preview image).
export function notesChartSvgMarkup(confirmedCents = 0) {
  const G = NOTES_CHART_GEOMETRY;
  const { beam } = G;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${G.width} ${G.height}" width="${G.width}" height="${G.height}">`];
  for (const y of G.staffLines) parts.push(`<rect x="0" y="${y}" width="${G.width}" height="2" fill="#e8d9a8"/>`);
  parts.push(`<rect x="${beam.x}" y="${beam.y}" width="${beam.width}" height="${beam.height}" rx="10" fill="#4f101c" transform="translate(${beam.x} ${beam.y}) skewY(${beam.skewDeg}) translate(${-beam.x} ${-beam.y})"/>`);
  for (const stem of G.stems) parts.push(`<rect x="${stem.x}" y="${stem.y}" width="${stem.width}" height="${stem.height}" rx="8" fill="#4f101c"/>`);
  for (const head of G.heads) parts.push(`<ellipse cx="${head.cx}" cy="${head.cy}" rx="${G.headRadius.rx}" ry="${G.headRadius.ry}" fill="#4f101c" transform="rotate(${G.headRotateDeg} ${head.cx} ${head.cy})"/>`);
  for (const square of notesChartSquares(confirmedCents)) {
    const head = G.heads.find((item) => item.id === square.group);
    const transform = head ? ` transform="rotate(${G.headRotateDeg} ${head.cx} ${head.cy})"` : "";
    parts.push(`<g${transform}><rect x="${square.x}" y="${square.y}" width="${square.width}" height="${square.height}" rx="5" fill="${square.filled ? "#c5a028" : "#ffffff"}"/></g>`);
  }
  parts.push("</svg>");
  return parts.join("");
}

// ---- Staff-recorded expected gifts (#110) ---------------------------------------------------
// A promise (for example an employer giving platform gift) that staff record before the money
// arrives. Pending like a reported gift: in no total and no receipt until staff confirm it.
export const EXPECTED_GIFT_METHODS = Object.freeze(["employer_platform", "check", "cash", "other"]);
export const EXPECTED_GIFT_METHOD_LABELS = Object.freeze({ employer_platform: "Employer giving platform", check: "Check", cash: "Cash", other: "Other" });
export const EXPECTED_GIFT_TYPES = Object.freeze(["donation", "employee_gift", "employer_match"]);
export const EXPECTED_GIFT_TYPE_LABELS = Object.freeze({ donation: "Donation", employee_gift: "Employee gift", employer_match: "Employer match" });

// sponsor_gifts accepts online, check, cash or other; an employer platform gift is "other".
export function sponsorGiftMethod(method) {
  return method === "check" || method === "cash" ? method : "other";
}

function isoDate(value, label) {
  if (value == null || value === "") return null;
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) throw new Error(`Enter the ${label} as a date.`);
  return text;
}

export function validateExpectedGift(input = {}) {
  const donorName = String(input.donor_name || "").trim();
  if (!donorName) throw new Error("Enter the donor's name.");
  if (donorName.length > 160) throw new Error("Keep the donor name under 160 characters.");
  const method = String(input.method || "");
  if (!EXPECTED_GIFT_METHODS.includes(method)) throw new Error("Choose how the gift will arrive.");
  const giftType = input.gift_type ? String(input.gift_type) : "donation";
  if (!EXPECTED_GIFT_TYPES.includes(giftType)) throw new Error("Choose the kind of gift.");
  const donorEmail = String(input.donor_email || "").trim().toLowerCase();
  if (donorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donorEmail)) throw new Error("Enter a valid receipt email or leave it blank.");
  const studentId = input.student_id ? String(input.student_id) : null;
  if (studentId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentId)) throw new Error("Choose a student from the list.");
  const text = (value, max, label) => {
    const out = String(value || "").trim();
    if (out.length > max) throw new Error(`Keep the ${label} under ${max} characters.`);
    return out;
  };
  return {
    portal_student_id: studentId,
    donor_name: donorName,
    donor_email: donorEmail,
    amount_cents: reportedAmountCents(input),
    method,
    platform: text(input.platform, 80, "platform"),
    gift_type: giftType,
    gift_date: isoDate(input.gift_date, "gift date"),
    expected_date: isoDate(input.expected_date, "expected date"),
    designation: text(input.designation, 300, "designation"),
    note: text(input.note, 500, "note")
  };
}

export function pendingExpectedCents(items = []) {
  return items.filter((item) => item?.status === "expected").reduce((sum, item) => sum + Number(item.amount_cents || 0), 0);
}

export function expectedConfirmation(item, body = {}) {
  if (item?.status !== "expected") throw new Error("This expected gift was already confirmed or cancelled.");
  const adjusted = (body.amount != null && body.amount !== "") || (body.amount_cents != null && body.amount_cents !== "");
  const amountCents = adjusted ? reportedAmountCents(body) : item.amount_cents;
  const method = body.method ? String(body.method) : item.method;
  if (!EXPECTED_GIFT_METHODS.includes(method)) throw new Error("Choose how the gift arrived.");
  return { amountCents, method, adjusted: amountCents !== item.amount_cents || method !== item.method };
}
