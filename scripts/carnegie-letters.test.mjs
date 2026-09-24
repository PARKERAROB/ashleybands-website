import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import * as letters from "../lib/carnegieLetters.mjs";
import { ROLE_CAPABILITIES, STAFF_CAPABILITIES } from "../lib/staffCapabilities.js";

// Carnegie student letters, path A (#106). Pure rules plus static boundary checks.
// The end-to-end HTTP proof against an isolated local database is carnegie-letters-e2e.test.mjs.

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}
// Files containing any pattern, tracked or new (git grep exits 1 when nothing matches).
function gitGrepFiles(patterns, paths) {
  try {
    return execFileSync("git", ["grep", "--untracked", "-l", ...patterns.flatMap((p) => ["-e", p]), "--", ...paths], { encoding: "utf8" }).split("\n").filter(Boolean);
  } catch (error) {
    if (error.status === 1) return [];
    throw error;
  }
}
const NEW_SURFACES = [
  ...filesUnder("app/portal/carnegie-notes"),
  ...filesUnder("app/admin/carnegie-letters"),
  ...filesUnder("app/api/portal/carnegie-notes"),
  ...filesUnder("app/api/admin/carnegie-letters"),
  ...filesUnder("app/api/admin/carnegie-reported-gifts"),
  ...filesUnder("app/api/admin/carnegie-expected-gifts"),
  ...filesUnder("app/api/carnegie-notes")
].filter((file) => /\.(jsx?|mjs)$/.test(file));
const ENTRY_POINTS = NEW_SURFACES.filter((file) => /(page\.jsx|route\.js)$/.test(file));

// ---- Chart fill rule -------------------------------------------------------------------------
test("the chart has 62 squares of $5 and $10 totaling $500, shaped as the approved notes", () => {
  const squares = letters.notesChartSquares(0);
  assert.equal(squares.length, 62);
  assert.equal(squares.reduce((sum, square) => sum + square.value, 0), 500);
  assert.ok(squares.every((square) => square.value === 5 || square.value === 10));
  const byGroup = (group) => squares.filter((square) => square.group === group);
  assert.equal(byGroup("headL").length, 16);
  assert.equal(byGroup("headR").length, 16);
  assert.equal(byGroup("headL").reduce((s, q) => s + q.value, 0) + byGroup("headR").reduce((s, q) => s + q.value, 0), 260);
  assert.equal(byGroup("stemL").length + byGroup("stemR").length + byGroup("beamLow").length + byGroup("beamHigh").length, 30);
  assert.equal(letters.NOTES_GOAL_CENTS, 50_000);
});

test("squares fill in order only from the confirmed amount", () => {
  assert.equal(letters.notesChartSummary(0).filledCount, 0);
  assert.equal(letters.notesChartSummary(499).filledCount, 0, "under $5 fills nothing");
  assert.equal(letters.notesChartSummary(500).filledCount, 1);
  assert.equal(letters.notesChartSummary(700).filledCents, 500, "$7 fills one $5 square");
  const ten = letters.notesChartSquares(1000);
  assert.deepEqual(ten.filter((s) => s.filled).map((s) => s.index), [0, 1]);
  // A $10 square that does not fit is skipped; a later $5 square still fills.
  const twenty = letters.notesChartSquares(2000);
  assert.deepEqual(twenty.filter((s) => s.filled).map((s) => s.value), [5, 5, 5, 5]);
  assert.equal(letters.notesChartSummary(2000).filledCents, 2000);
  for (let dollars = 0; dollars <= 500; dollars += 5) {
    const summary = letters.notesChartSummary(dollars * 100);
    assert.ok(summary.filledCents <= dollars * 100, `never overfills at $${dollars}`);
    assert.ok(dollars * 100 - summary.filledCents <= 1000, `leaves at most one note's gap at $${dollars}`);
  }
  assert.equal(letters.notesChartSummary(50_000).filledCount, 62);
  assert.equal(letters.notesChartSummary(90_000).filledCount, 62, "above $500 every square is filled");
  assert.equal(letters.notesChartSummary(50_000).complete, true);
  assert.equal(letters.notesChartSummary(49_999).complete, false);
});

test("pending reported gifts never fill a square and change no confirmed figure", () => {
  const plain = letters.notesChartSummary(1000, 0);
  const withPending = letters.notesChartSummary(1000, 4000);
  assert.equal(withPending.filledCount, plain.filledCount);
  assert.equal(withPending.filledCents, plain.filledCents);
  assert.ok(withPending.pendingCount > 0);
  assert.ok(withPending.squares.every((square) => !(square.filled && square.state === "pending")));
  assert.equal(letters.notesChartSummary(0, 0).pendingCount, 0);
  assert.equal(letters.pendingNotesLine(4000), "$40 waiting for staff to confirm.");
  assert.equal(letters.pendingNotesLine(0), "");
});

// ---- Wording rules ---------------------------------------------------------------------------
test("student wording follows the director's rules", () => {
  assert.equal(letters.TRIP_ESTIMATE_LINE, "Estimated trip cost: $2,500 per student. Everything the band raises brings that down for everyone.");
  assert.equal(letters.notesStatusLine(50_000), "You filled your notes! Keep going: every extra note helps a bandmate get there.");
  assert.equal(letters.notesStatusLine(70_000), letters.NOTES_FILLED_LINE);
  assert.notEqual(letters.notesStatusLine(49_900), letters.NOTES_FILLED_LINE);
  assert.equal(letters.CAMPAIGN_GIFT_LINE, "Every gift goes to the band's Carnegie campaign and lowers the trip cost for every student who goes.");
  const composed = letters.composeCarnegieLetter({ recipientType: "someone_i_know", recipientName: "Aunt Lee", meaningText: "m", helpText: "h", firstName: "Alex Sample", code: "abcDEF123456" });
  assert.equal(composed.ask, "Would you help me fill my music notes? My part of the team goal is $500, and every $5 or $10 note makes a difference. Every gift goes to the band's Carnegie campaign and lowers the trip cost for all of us.");
  assert.equal(composed.signature, "Alex", "first name only");
    assert.match(composed.payLine, /Carnegie · Alex/);
  assert.equal(letters.CARNEGIE_CHECK_PAYEE, "Ashley High School Band Boosters", "director's payee wording");
  assert.match(composed.payLine, /Ashley High School Band Boosters/);
  assert.match(read("app/portal/carnegie-notes/packet/[id]/page.jsx"), /payable to \{CARNEGIE_CHECK_PAYEE\}[\s\S]*Make checks payable to \{CARNEGIE_CHECK_PAYEE\}/, "how to pay and the gift slip");

  const studentCopy = [
    ...NEW_SURFACES.filter((file) => !file.includes("/api/")).map((file) => readFileSync(file, "utf8")),
    read("app/support/[code]/carnegie/page.jsx"),
    Object.values(composed).join(" "),
    letters.TRIP_ESTIMATE_LINE, letters.NOTES_FILLED_LINE, letters.NOTES_FILL_HINT, letters.CAMPAIGN_GIFT_LINE,
    letters.REPORTED_GIFT_ENVELOPE_LINE, letters.GIFT_SLIP_LINE, ...Object.values(letters.REPORTED_GIFT_STATUS_LABELS),
    letters.carnegieShareText("abcDEF123456"), letters.carnegieLinkPreview("Alex").description
  ].join("\n");
  for (const pattern of letters.FORBIDDEN_STUDENT_WORDS) assert.doesNotMatch(studentCopy, pattern);
  assert.doesNotMatch(studentCopy, /venmo|zelle|cash ?app/i, "no person-to-person payment apps");
  assert.doesNotMatch(studentCopy, /100%/, "no 100% claim");
});

// ---- Letter states ---------------------------------------------------------------------------
test("status transitions follow Draft → Needs review → Approved for print → Printed → Delivery reported", () => {
  const next = letters.nextLetterStatus;
  assert.equal(next("draft", "submit", "family"), "needs_review");
  assert.equal(next("needs_review", "approve", "staff"), "approved");
  assert.equal(next("needs_review", "return_to_draft", "staff"), "draft");
  assert.equal(next("approved", "mark_printed", "family"), "printed");
  assert.equal(next("approved", "mark_printed", "staff"), "printed");
  assert.equal(next("printed", "report_delivery", "family"), "delivery_reported");
  assert.equal(next("approved", "report_delivery", "family"), "delivery_reported", "sent by email or text without printing");
  assert.throws(() => next("needs_review", "approve", "family"), /not available/, "families cannot approve");
  assert.throws(() => next("draft", "submit", "staff"), /not available/, "staff do not write for students");
  assert.throws(() => next("draft", "approve", "staff"), /cannot/, "only a letter in review can be approved");
  assert.throws(() => next("draft", "mark_printed", "family"), /cannot/);
  assert.throws(() => next("needs_review", "report_delivery", "family"), /cannot/, "nothing is delivered before approval");
  assert.throws(() => next("delivery_reported", "report_delivery", "staff"), /cannot/);
  assert.throws(() => next("draft", "delete", "family"), /Unknown/);
  assert.deepEqual(Object.keys(letters.LETTER_STATUS_LABELS), [...letters.LETTER_STATUSES]);
});

test("an edit after approval returns the letter to review and voids the approval", () => {
  assert.equal(letters.statusAfterEdit("approved"), "needs_review");
  assert.equal(letters.statusAfterEdit("printed"), "needs_review");
  assert.equal(letters.statusAfterEdit("needs_review"), "needs_review");
  assert.equal(letters.statusAfterEdit("draft"), "draft");
  assert.throws(() => letters.statusAfterEdit("delivery_reported"), /can no longer change/);
  assert.equal(letters.letterIsPrintable({ status: "approved", version: 3, approved_version: 3 }), true);
  assert.equal(letters.letterIsPrintable({ status: "approved", version: 4, approved_version: 3 }), false, "approval covers one exact version");
  assert.equal(letters.letterIsPrintable({ status: "needs_review", version: 4, approved_version: null }), false);
  const migration = read("supabase/migrations/202609240002_carnegie_student_letters.sql");
  assert.match(migration, /if old\.status in \('approved', 'printed'\)[\s\S]*new\.status := 'needs_review'/, "the database enforces it too");
  assert.match(migration, /approved_version = version and approved_at is not null/);
  assert.match(migration, /A delivered letter cannot change/);
});

test("the student's words are stored exactly as typed and only path A recipients are allowed", () => {
  const typed = "  Band taught me to listen.\n\nI love my section!  ";
  const content = letters.validateLetterContent({ recipient_type: "someone_i_know", recipient_name: " Coach R ", meaning_text: typed, help_text: "x" });
  assert.equal(content.meaning_text, typed);
  assert.equal(content.recipient_name, " Coach R ");
  assert.throws(() => letters.validateLetterContent({ recipient_type: "business" }), /Choose who/);
  assert.throws(() => letters.validateLetterContent({ recipient_type: "organization" }), /Choose who/);
  assert.throws(() => letters.validateLetterContent({ recipient_type: "someone_i_know", meaning_text: "x".repeat(1501) }), /under 1500/);
  assert.throws(() => letters.validateLetterContent({ recipient_type: "someone_i_know", meaning_text: "a", help_text: "b" }, { requireComplete: true }), /name/);
  const general = letters.validateLetterContent({ recipient_type: "general_supporter", recipient_name: "Someone", recipient_email: "a@example.com", meaning_text: "a", help_text: "b" }, { requireComplete: true });
  assert.equal(general.recipient_name, "");
  assert.equal(general.recipient_email, "");
  assert.equal(letters.composeCarnegieLetter({ recipientType: "general_supporter" }).greeting, "Dear Friend,");
  assert.deepEqual(letters.RECIPIENT_TYPES.filter((type) => type.enabled).map((type) => type.value), ["someone_i_know", "general_supporter"]);
  const noRewrite = read("lib/carnegieLettersServer.js") + NEW_SURFACES.map((file) => readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(noRewrite, /anthropic|openai|completion|rewrite\(/i, "no automated rewriting");
});

// ---- Gate ------------------------------------------------------------------------------------
test("the gate is OFF unless explicitly set, including in production", () => {
  assert.equal(letters.carnegieLettersMode({}), "off");
  assert.equal(letters.carnegieLettersMode({ NODE_ENV: "production", VERCEL_ENV: "production" }), "off");
  assert.equal(letters.carnegieLettersMode({ CARNEGIE_LETTERS_MODE: "true" }), "off");
  assert.equal(letters.carnegieLettersMode({ CARNEGIE_LETTERS_MODE: "1" }), "off");
  assert.equal(letters.carnegieLettersMode({ CARNEGIE_LETTERS_MODE: "staff" }), "staff");
  assert.equal(letters.carnegieLettersMode({ CARNEGIE_LETTERS_MODE: " ON " }), "on");
  const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean)
    .filter((file) => /(^|\/)\.env|vercel\.json$|next\.config\.js$|\.github\//.test(file));
  for (const file of tracked) assert.doesNotMatch(read(file), /CARNEGIE_LETTERS_MODE/, `${file} must not turn the gate on`);
});

test("every new page and API checks the gate first, and nothing links to the new pages", () => {
  assert.ok(ENTRY_POINTS.length >= 11, "all entry points found");
  for (const file of ENTRY_POINTS) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /carnegieLettersAccess\(/, `${file} checks the gate`);
    assert.match(source, /if \(!access\.open\) (notFound\(\)|return (\{ response: )?(privateJson\(\{ error: "Not found\." \}, 404\)|new Response\("Not found", \{ status: 404 \}\)))/, `${file} is 404 when closed`);
  }
  const server = read("lib/carnegieLettersServer.js");
  assert.match(server, /if \(mode === "off"\) return \{ open: false/);
  assert.match(server, /if \(mode === "staff" && !staff\) return \{ open: false/);
  const landing = read("app/support/[code]/carnegie/page.jsx");
  assert.match(landing, /if \(!access\.open\) redirect\(`\$\{CARNEGIE_GIVING_PATH\}\?a=\$\{encodeURIComponent\(token\)\}#make-a-gift`\)/, "gate off keeps the #103 redirect");
  assert.match(landing, /generateMetadata[\s\S]*if \(!access\.open\) return \{\};/, "gate off adds no metadata");
  const linkers = gitGrepFiles(["/portal/carnegie-notes", "/admin/carnegie-letters"], ["app", "components", "content", "public"]);
  for (const file of linkers) assert.ok(NEW_SURFACES.includes(file) || file.startsWith("app/api/"), `${file} must not link to the gated pages`);
});

// ---- Privacy ---------------------------------------------------------------------------------
test("family routes scope to trusted students; staff routes need staff capability", () => {
  const server = read("lib/carnegieLettersServer.js");
  assert.match(server, /export async function loadFamilyLetter[\s\S]*trustedStudentIds\(personId\)[\s\S]*allowed\.includes\(data\.portal_student_id\) \? data : null/);
  assert.match(server, /export async function createFamilyLetter[\s\S]*if \(!allowed\.includes\(studentId\)\) return \{ status: 404/);
  assert.match(server, /export async function createReportedGift[\s\S]*if \(!allowed\.includes\(studentId\)\) return \{ status: 404/);
  for (const file of filesUnder("app/api/portal/carnegie-notes")) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /portalPerson\(req\)/, `${file} requires a portal session`);
    assert.match(source, /Sign in to the Family Portal first\." \}, 401/, `${file} refuses anonymous visitors`);
  }
  for (const file of [...filesUnder("app/api/admin/carnegie-letters"), ...filesUnder("app/api/admin/carnegie-reported-gifts"), ...filesUnder("app/api/admin/carnegie-expected-gifts")]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /authorizeLetterReviewer\(req\)|authorizeStaffRequest\(req, STAFF_CAPABILITIES\.SPONSORSHIP_GIFTS_WRITE\)/, `${file} requires staff`);
    assert.match(source, /logAudit\(/, `${file} is audited`);
  }
  const packet = read("app/portal/carnegie-notes/packet/[id]/page.jsx");
  assert.match(packet, /loadFamilyLetter\(session\.personId, id\)/);
  assert.match(packet, /authorizeLetterReviewer\(requestLike\)/);
  assert.match(read("lib/carnegieLettersServer.js"), /authorizeStaffRequest\(requestLike, STAFF_CAPABILITIES\.CARNEGIE_LETTERS_REVIEW, \{ safeCapabilityOnly: true \}\)/);
  assert.match(packet, /if \(!resolved\) notFound\(\)/);
  assert.equal(STAFF_CAPABILITIES.CARNEGIE_LETTERS_REVIEW, "carnegie.letters.review");
  // Director decision 2026-09-24: every portal staff role reviews letters, except the no-family-data research role.
  for (const [role, capabilities] of Object.entries(ROLE_CAPABILITIES)) {
    const reviews = capabilities.includes("*") || capabilities.includes("carnegie.letters.review");
    assert.equal(reviews, role !== "campaign_researcher", `${role} review access`);
  }
  const migration = read("supabase/migrations/202609240002_carnegie_student_letters.sql");
  for (const table of ["carnegie_student_letters", "carnegie_student_letter_events", "carnegie_reported_gifts", "carnegie_reported_gift_events"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security;`));
    assert.match(migration, new RegExp(`revoke all privileges on table public\\.${table} from anon, authenticated;`));
  }
  assert.doesNotMatch(migration, /^\s*(alter|drop|update|delete|insert)\s+(table\s+)?public\.(?!carnegie_(student_letter|reported_gift))/im, "touches no existing table");
});

// ---- Reported offline gifts ------------------------------------------------------------------
test("reported gifts are validated, count nowhere, and confirm at the confirmed amount", () => {
  const report = letters.validateReportedGift({ donor_name: " Pat ", amount: "$40", method: "check", check_number: "1201", donor_email: "PAT@EXAMPLE.COM" });
  assert.deepEqual(report, { donor_name: "Pat", donor_email: "pat@example.com", reported_amount_cents: 4000, reported_method: "check", check_number: "1201", note: "" });
  assert.equal(letters.validateReportedGift({ donor_name: "A", amount: "1", method: "cash", check_number: "9" }).check_number, "", "cash has no check number");
  assert.throws(() => letters.validateReportedGift({ donor_name: "", amount: "5", method: "cash" }), /name/);
  assert.throws(() => letters.validateReportedGift({ donor_name: "A", amount: "0.99", method: "cash" }), /at least \$1/);
  assert.throws(() => letters.validateReportedGift({ donor_name: "A", amount: "5", method: "venmo" }), /cash or check/);
  assert.throws(() => letters.validateReportedGift({ donor_name: "A", amount: "5", method: "cash", donor_email: "nope" }), /valid email/);

  const reports = [
    { status: "reported", reported_amount_cents: 4000 },
    { status: "reported", reported_amount_cents: 1500 },
    { status: "confirmed", reported_amount_cents: 2000, confirmed_amount_cents: 2000 },
    { status: "rejected", reported_amount_cents: 9000 }
  ];
  assert.equal(letters.pendingReportedCents(reports), 5500, "only waiting reports are pending");

  const waiting = { status: "reported", reported_amount_cents: 4000, reported_method: "cash" };
  assert.deepEqual(letters.confirmationFromReview(waiting, {}), { amountCents: 4000, method: "cash", adjusted: false });
  assert.deepEqual(letters.confirmationFromReview(waiting, { amount: "35.50", method: "check" }), { amountCents: 3550, method: "check", adjusted: true });
  assert.throws(() => letters.confirmationFromReview({ ...waiting, status: "confirmed" }, {}), /already reviewed/);
  assert.throws(() => letters.confirmationFromReview({ ...waiting, status: "rejected" }, {}), /already reviewed/);
  assert.throws(() => letters.rejectionReason({ reason: "  " }), /reason/);

  // No total anywhere reads the reported table; only the letters server module does.
  const readers = gitGrepFiles(["carnegie_reported_gifts"], ["app", "lib", "components", "scripts", "supabase"]);
  const allowed = new Set(["lib/carnegieLettersServer.js", "supabase/migrations/202609240002_carnegie_student_letters.sql", "scripts/carnegie-letters.test.mjs", "scripts/carnegie-letters-e2e.test.mjs", "scripts/security-boundary.test.mjs"]);
  for (const file of new Set(readers)) assert.ok(allowed.has(file) || file.startsWith("app/api/"), `${file} must not read reported gifts`);
  for (const file of ["lib/sponsorCampaigns.mjs", "lib/carnegieFunding.mjs", "lib/billing.js", "lib/financialOperations.js"]) {
    assert.doesNotMatch(read(file), /carnegie_reported_gifts/);
  }
  const server = read("lib/carnegieLettersServer.js");
  assert.match(server, /requestKey: report\.id/, "one report maps to one idempotent gift");
  assert.match(server, /staffStudentId: report\.portal_student_id/);
  assert.match(server, /campaignCode: CARNEGIE_CAMPAIGN/);
  assert.match(server, /listOnSite: false/, "confirmation never publishes recognition");
  assert.match(read("supabase/migrations/202609240002_carnegie_student_letters.sql"), /sponsor_gift_id uuid unique references public\.sponsor_gifts\(id\)/);
});

// ---- Sharing and link preview ----------------------------------------------------------------
test("email and text sharing carry the student's own Carnegie link", () => {
  const code = "abcDEF123456";
  const url = "https://ashleybands.com/support/abcDEF123456/carnegie";
  assert.equal(letters.carnegieShareText(code), `I'm helping our band get to Carnegie Hall! Would you fill a music note for me? ${url}`);
  assert.equal(letters.smsHref("hi there"), "sms:?&body=hi%20there");
  const approved = { recipient_type: "someone_i_know", recipient_name: "Aunt Lee", recipient_email: "lee@example.com", meaning_text: "Band is home.", help_text: "You always cheer.", status: "approved", version: 2, approved_version: 2 };
  const mail = letters.letterMailto(approved, { firstName: "Alex", code });
  assert.equal(mail.fits, true);
  assert.ok(mail.href.startsWith("mailto:lee@example.com?subject=Help%20me%20get%20to%20Carnegie%20Hall&body="));
  assert.ok(decodeURIComponent(mail.href).includes(url));
  assert.ok(mail.text.includes("Band is home.") && mail.text.includes("You always cheer."));
  const general = letters.letterMailto({ ...approved, recipient_type: "general_supporter" }, { firstName: "Alex", code });
  assert.ok(general.href.startsWith("mailto:?subject="), "To stays blank without a recipient email");
  const long = letters.letterMailto({ ...approved, meaning_text: "x".repeat(1500), help_text: "y".repeat(1000) }, { firstName: "Alex", code });
  assert.equal(long.fits, false);
  assert.ok(long.href.length <= letters.MAILTO_MAX_LENGTH);
  assert.ok(decodeURIComponent(long.href).includes(url), "the short email still has the link");
  assert.ok(long.text.includes("x".repeat(1500)), "Copy letter has the full text");
});

test("only an approved exact version shows email and print; the fixed text needs no approval", () => {
  const base = { recipient_type: "someone_i_know", recipient_name: "A", version: 1 };
  assert.deepEqual(letters.letterSendActions({ ...base, status: "draft", approved_version: null }), []);
  assert.deepEqual(letters.letterSendActions({ ...base, status: "needs_review", approved_version: null }), []);
  assert.deepEqual(letters.letterSendActions({ ...base, status: "approved", version: 2, approved_version: 1 }), []);
  assert.deepEqual(letters.letterSendActions({ ...base, status: "approved", approved_version: 1 }), ["email", "text", "print", "report_sent"]);
  assert.deepEqual(letters.letterSendActions({ ...base, status: "delivery_reported", approved_version: 1 }), ["email", "text", "print"]);
  assert.equal(letters.carnegieShareText.length, 1, "the fixed message depends only on the link");
  const client = read("app/portal/carnegie-notes/CarnegieNotesClient.jsx");
  assert.match(client, /<ShareTextButton code=\{linkCode\(student\)\}/, "the student page offers the fixed text right away");
  assert.match(client, /const actions = code \? letterSendActions\(letter\) : \[\];/);
  assert.doesNotMatch(read("lib/carnegieLettersServer.js") + NEW_SURFACES.map((file) => readFileSync(file, "utf8")).join("\n"), /resend|sendEmail|twilio/i, "the website sends nothing");
});

test("link preview metadata has first name only and no private data", () => {
  const preview = letters.carnegieLinkPreview("Alex Sample");
  assert.equal(preview.title, "Help Alex get to Carnegie Hall");
  const all = Object.values(preview).join(" ");
  assert.doesNotMatch(all, /Sample/);
  assert.doesNotMatch(all, /\$\d/, "no amounts");
  assert.doesNotMatch(all, /@/);
  assert.equal(letters.carnegieLinkPreview("").title, "Help Ashley Bands get to Carnegie Hall");
  const og = read("app/api/carnegie-notes/og/route.js");
  assert.doesNotMatch(og, /resolveSponsorStudentCode|portal_students|sponsor_gifts|confirmedNotesCents/, "the preview image has no student data");
  assert.match(og, /notesChartSvgMarkup\(0\)/);
  const markup = letters.notesChartSvgMarkup(0);
  assert.equal((markup.match(/<rect x="[\d.]+" y="[\d.]+" width="(44|50)"/g) || []).length, 62);
});

test("the employer-match line appears on the landing, the packet back and the email, naming no employer", () => {
  assert.equal(letters.EMPLOYER_MATCH_LINE, "Does your employer match gifts? Ask HR. It could double your gift.");
  assert.doesNotMatch(letters.EMPLOYER_MATCH_LINE, /\u2014|guarantee|eligible|benevity|yourcause|double the donation/i);
  assert.match(read("app/support/[code]/carnegie/page.jsx"), /\{EMPLOYER_MATCH_LINE\}/);
  assert.match(read("app/portal/carnegie-notes/packet/[id]/page.jsx"), /How to pay[\s\S]*\{EMPLOYER_MATCH_LINE\}[\s\S]*Gift slip/);
  const letter = { recipient_type: "someone_i_know", recipient_name: "Aunt Lee", meaning_text: "m", help_text: "h", status: "approved", version: 1, approved_version: 1 };
  const body = letters.letterPlainText(letter, { firstName: "Alex", code: "abcDEF123456" });
  const parts = body.split("\n\n");
  assert.equal(parts.at(-2), letters.EMPLOYER_MATCH_LINE, "at the end of the email, just before the link");
  assert.match(parts.at(-1), /https:\/\/ashleybands\.com\/support\/abcDEF123456\/carnegie$/);
});

test("the payee reads Ashley High School Band Boosters everywhere at runtime (#111)", () => {
  assert.equal(read("lib/sponsorshipContent.js").match(/boosterOrg: "([^"]+)"/)[1], "Ashley High School Band Boosters");
  assert.equal(letters.CARNEGIE_CHECK_PAYEE, "Ashley High School Band Boosters");
  const runtime = gitGrepFiles(["AHS Band Boosters"], ["app", "lib", "components", "content", "public"]);
  assert.deepEqual(runtime, [], "no short payee name left in site source");
});

test("expected gifts are validated, pending only, and never read by a total (#110)", () => {
  const item = letters.validateExpectedGift({ donor_name: " Donor Example ", amount: "2,000.00", method: "employer_platform", platform: "Giving platform", gift_type: "employer_match", gift_date: "2026-09-23", designation: "Carnegie" });
  assert.equal(item.amount_cents, 200000);
  assert.equal(item.donor_name, "Donor Example");
  assert.equal(item.gift_type, "employer_match");
  assert.throws(() => letters.validateExpectedGift({ donor_name: "A", amount: "5", method: "venmo" }), /arrive/);
  assert.throws(() => letters.validateExpectedGift({ donor_name: "A", amount: "5", method: "check", gift_date: "9/23" }), /date/);
  assert.throws(() => letters.validateExpectedGift({ donor_name: "", amount: "5", method: "check" }), /name/);
  assert.equal(letters.sponsorGiftMethod("employer_platform"), "other");
  assert.equal(letters.sponsorGiftMethod("check"), "check");
  assert.equal(letters.pendingExpectedCents([{ status: "expected", amount_cents: 200000 }, { status: "confirmed", amount_cents: 5 }, { status: "cancelled", amount_cents: 7 }]), 200000);
  assert.deepEqual(letters.expectedConfirmation({ status: "expected", amount_cents: 200000, method: "employer_platform" }, { amount: "1990", method: "check" }), { amountCents: 199000, method: "check", adjusted: true });
  assert.throws(() => letters.expectedConfirmation({ status: "cancelled", amount_cents: 1, method: "cash" }, {}), /already/);
  const readers = gitGrepFiles(["carnegie_expected_gifts"], ["app", "lib", "components", "scripts", "supabase"]);
  const allowed = new Set(["lib/carnegieLettersServer.js", "supabase/migrations/202609240003_carnegie_expected_gifts.sql", "scripts/carnegie-letters.test.mjs", "scripts/carnegie-letters-e2e.test.mjs", "scripts/security-boundary.test.mjs"]);
  for (const file of readers) assert.ok(allowed.has(file) || file.startsWith("app/api/admin/carnegie-expected-gifts/"), `${file} must not read expected gifts`);
  const server = read("lib/carnegieLettersServer.js");
  assert.match(server, /requestKey: item\.id/, "one expected item maps to one idempotent gift");
  assert.match(server, /export async function expectedForStudents[\s\S]*\.eq\("status", "expected"\)/, "only waiting items show as pending");
  const migration = read("supabase/migrations/202609240003_carnegie_expected_gifts.sql");
  assert.match(migration, /sponsor_gift_id uuid unique references public\.sponsor_gifts\(id\)/);
  assert.match(migration, /A confirmed or cancelled expected gift is final/);
  assert.doesNotMatch(migration, /^\s*(alter|drop|update|delete|insert)\s+(table\s+)?public\.(?!carnegie_expected_gift)/im);
});
