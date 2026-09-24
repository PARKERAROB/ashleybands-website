import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import crypto from "node:crypto";
import test from "node:test";

// End-to-end proof for Carnegie student letters and reported gifts (#106), over HTTP against a
// running dev server backed by an ISOLATED LOCAL Supabase stack with synthetic fixtures.
//
//   CARNEGIE_LETTERS_E2E_BASE=http://localhost:3106        server with CARNEGIE_LETTERS_MODE=staff
//   CARNEGIE_LETTERS_E2E_OFF_BASE=http://localhost:3107    optional: same code with the gate unset
//   CARNEGIE_LETTERS_E2E_SUPABASE_URL=http://127.0.0.1:55421
//   CARNEGIE_LETTERS_E2E_SECRET_KEY=<local secret key>     CARNEGIE_LETTERS_E2E_SESSION_SECRET=<local>
//   CARNEGIE_LETTERS_E2E_PSQL="docker exec -i <local db container> psql -U postgres -v ON_ERROR_STOP=1"
//     (roster mirror tables are not writable by the service role, as in production)
//
// It refuses to run against anything but localhost. It never touches production.

const env = process.env;
const BASE = env.CARNEGIE_LETTERS_E2E_BASE || "";
const OFF_BASE = env.CARNEGIE_LETTERS_E2E_OFF_BASE || "";
const DB = env.CARNEGIE_LETTERS_E2E_SUPABASE_URL || "";
const KEY = env.CARNEGIE_LETTERS_E2E_SECRET_KEY || "";
const SESSION_SECRET = env.CARNEGIE_LETTERS_E2E_SESSION_SECRET || "";
const local = (url) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url);
const PSQL = env.CARNEGIE_LETTERS_E2E_PSQL || "";
const skip = !(BASE && DB && KEY && SESSION_SECRET && PSQL) ? "set CARNEGIE_LETTERS_E2E_* to run against a local preview" : false;
if (!skip) {
  assert.ok(local(BASE) && local(DB) && (!OFF_BASE || local(OFF_BASE)), "end-to-end checks run only against localhost");
  assert.match(PSQL, /^docker exec -i [\w.-]+ psql /, "fixtures load only into a local container");
}
const sql = (text) => execSync(PSQL, { input: text, encoding: "utf8" });
const q = (value) => `'${String(value).replace(/'/g, "''")}'`;

function sign(payload) {
  const encoded = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  return `${encoded}.${crypto.createHmac("sha256", SESSION_SECRET).update(encoded).digest("base64url")}`;
}
const portalCookie = (personId) => `ab_portal_session=${sign({ personId, email: "family@example.com" })}`;
const staffCookie = (id, token) => `ab_staff_session=${sign({ id, token })}`;
const cookies = (...parts) => parts.filter(Boolean).join("; ");

async function db(pathname, { method = "GET", body, prefer } = {}) {
  const response = await fetch(`${DB}/rest/v1/${pathname}`, {
    method,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${pathname}: ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function call(path, { method = "GET", cookie = "", body, base = BASE, redirect = "manual" } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    redirect,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const type = response.headers.get("content-type") || "";
  const data = type.includes("json") ? await response.json() : await response.text();
  return { status: response.status, data, headers: response.headers };
}

// Fresh synthetic fixtures per run.
const run = crypto.randomUUID().slice(0, 8);
const ids = {
  guardianA: crypto.randomUUID(), guardianB: crypto.randomUUID(),
  studentA: crypto.randomUUID(), studentB: crypto.randomUUID(),
  director: crypto.randomUUID(), directorToken: crypto.randomUUID(),
  worker: crypto.randomUUID(), workerToken: crypto.randomUUID(),
  eventWorker: crypto.randomUUID(), eventWorkerToken: crypto.randomUUID()
};
const codeA = `E2eA${run}`.slice(0, 16);
let A, B, DIRECTOR, WORKER, ANON;

test("set up synthetic fixtures", { skip }, async () => {
  sql(`
    insert into portal_people (id, source_person_key, person_type, display_name, source) values
      (${q(ids.guardianA)}, ${q(`e2e-a-${run}`)}, 'guardian', 'E2E Guardian A', 'e2e_fixture'),
      (${q(ids.guardianB)}, ${q(`e2e-b-${run}`)}, 'guardian', 'E2E Guardian B', 'e2e_fixture');
    insert into portal_students (id, source_student_id, display_name, preferred_first, legal_first, legal_last, status, source) values
      (${q(ids.studentA)}, ${q(`e2e-a-${run}`)}, 'Riley Fixture', 'Riley', 'Riley', 'Fixture', 'active', 'e2e_fixture'),
      (${q(ids.studentB)}, ${q(`e2e-b-${run}`)}, 'Morgan Fixture', 'Morgan', 'Morgan', 'Fixture', 'active', 'e2e_fixture');
    insert into portal_student_people (student_id, person_id, relationship_status, assurance_level, source) values
      (${q(ids.studentA)}, ${q(ids.guardianA)}, 'trusted', 'medium', 'e2e_fixture'),
      (${q(ids.studentB)}, ${q(ids.guardianB)}, 'trusted', 'medium', 'e2e_fixture');
    insert into sponsor_student_links (portal_student_id, code, source) values (${q(ids.studentA)}, ${q(codeA)}, 'family_portal');
    insert into staff (id, email, pin_hash, display_name, role, session_token) values
      (${q(ids.director)}, ${q(`director-${run}@example.com`)}, 'not-a-login', 'E2E Director', 'director', ${q(ids.directorToken)}),
      (${q(ids.worker)}, ${q(`worker-${run}@example.com`)}, 'not-a-login', 'E2E Researcher', 'campaign_researcher', ${q(ids.workerToken)}),
      (${q(ids.eventWorker)}, ${q(`event-${run}@example.com`)}, 'not-a-login', 'E2E Event Worker', 'event_worker', ${q(ids.eventWorkerToken)});
  `);
  // In staff-preview mode every request needs some staff session to pass the gate. Family checks
  // use a staff session with no letter or gift rights, so access is decided by the portal session.
  WORKER = staffCookie(ids.worker, ids.workerToken);
  DIRECTOR = staffCookie(ids.director, ids.directorToken);
  A = cookies(portalCookie(ids.guardianA), WORKER);
  B = cookies(portalCookie(ids.guardianB), WORKER);
  ANON = WORKER;
});

let letter;
test("the gate hides everything without a staff session in staff-preview mode", { skip }, async () => {
  assert.equal((await call("/portal/carnegie-notes", { cookie: portalCookie(ids.guardianA) })).status, 404);
  assert.equal((await call("/api/portal/carnegie-notes", { cookie: portalCookie(ids.guardianA) })).status, 404);
  assert.equal((await call("/admin/carnegie-letters")).status, 404);
  assert.equal((await call("/api/carnegie-notes/og")).status, 404);
  const landing = await call(`/support/${codeA}/carnegie`);
  assert.equal(landing.status, 307);
  assert.match(landing.headers.get("location"), /^\/support-carnegie\?a=[^#]+#make-a-gift$/, "public visitors keep the #103 redirect");
});

test("anonymous visitors and other families are denied", { skip }, async () => {
  assert.equal((await call("/api/portal/carnegie-notes", { cookie: ANON })).status, 401);
  assert.equal((await call("/api/portal/carnegie-notes/letters", { method: "POST", cookie: ANON, body: { student_id: ids.studentA, recipient_type: "someone_i_know" } })).status, 401);
  const created = await call("/api/portal/carnegie-notes/letters", { method: "POST", cookie: A, body: { student_id: ids.studentA, recipient_type: "someone_i_know", recipient_name: "Aunt Fixture", meaning_text: "  Band gave me friends.\n", help_text: "You always come to concerts." } });
  assert.equal(created.status, 201);
  letter = created.data.letter;
  assert.equal(letter.status, "draft");
  assert.equal(letter.meaning_text, "  Band gave me friends.\n", "stored exactly as typed");
  assert.equal((await call(`/api/portal/carnegie-notes/letters/${letter.id}`, { cookie: B })).status, 404);
  assert.equal((await call(`/api/portal/carnegie-notes/letters/${letter.id}`, { method: "PATCH", cookie: B, body: { action: "submit", version: 1 } })).status, 404);
  assert.equal((await call(`/api/portal/carnegie-notes/letters/${letter.id}`, { cookie: ANON })).status, 401);
  assert.equal((await call("/api/portal/carnegie-notes/letters", { method: "POST", cookie: B, body: { student_id: ids.studentA, recipient_type: "general_supporter" } })).status, 404);
  const mine = await call("/api/portal/carnegie-notes", { cookie: B });
  assert.equal(mine.status, 200);
  assert.ok(mine.data.students.every((student) => student.id !== ids.studentA), "B never sees A's student");
  assert.equal((await call(`/portal/carnegie-notes/packet/${letter.id}`, { cookie: B })).status, 404);
  assert.equal((await call("/api/admin/carnegie-letters", { cookie: WORKER })).status, 403, "staff without the review capability are refused");
  assert.equal((await call(`/portal/carnegie-notes/packet/${letter.id}`, { cookie: WORKER })).status, 404, "or from the packet");
});

test("draft → review → approve exact version → edit returns to review → print → delivery reported", { skip }, async () => {
  let response = await call(`/api/portal/carnegie-notes/letters/${letter.id}`, { method: "PATCH", cookie: A, body: { action: "submit", version: letter.version, recipient_name: "Aunt Fixture", meaning_text: letter.meaning_text, help_text: letter.help_text } });
  assert.equal(response.status, 200);
  assert.equal(response.data.letter.status, "needs_review");
  letter = response.data.letter;
  assert.equal((await call(`/api/admin/carnegie-letters/${letter.id}`, { method: "POST", cookie: DIRECTOR, body: { action: "approve", version: letter.version + 1 } })).status, 409, "approval must name the exact version");
  assert.equal((await call(`/api/admin/carnegie-letters/${letter.id}`, { method: "POST", cookie: WORKER, body: { action: "approve", version: letter.version } })).status, 403, "the research role cannot approve");
  assert.equal((await call("/api/admin/carnegie-letters", { cookie: staffCookie(ids.eventWorker, ids.eventWorkerToken) })).status, 200, "any portal staff role can open the review queue");
  assert.equal((await call(`/api/admin/carnegie-letters/${letter.id}`, { method: "POST", cookie: portalCookie(ids.guardianA), body: { action: "approve", version: letter.version } })).status, 404, "families cannot reach staff actions");
  response = await call(`/api/admin/carnegie-letters/${letter.id}`, { method: "POST", cookie: DIRECTOR, body: { action: "approve", version: letter.version } });
  assert.equal(response.status, 200);
  assert.equal(response.data.letter.status, "approved");
  assert.equal(response.data.letter.approved_version, letter.version);
  letter = response.data.letter;
  const packet = await call(`/portal/carnegie-notes/packet/${letter.id}`, { cookie: A });
  assert.equal(packet.status, 200);
  assert.match(packet.data, /support\/E2eA/);
  assert.match(packet.data, /Carnegie · Riley/);

  response = await call(`/api/portal/carnegie-notes/letters/${letter.id}`, { method: "PATCH", cookie: A, body: { action: "save", version: letter.version, recipient_name: "Aunt Fixture", meaning_text: "Band gave me my best friends.", help_text: letter.help_text } });
  assert.equal(response.status, 200);
  assert.equal(response.data.letter.status, "needs_review", "an edit after approval returns to review");
  assert.equal(response.data.letter.version, letter.version + 1);
  assert.equal(response.data.letter.approved_version, null);
  letter = response.data.letter;
  assert.doesNotMatch((await call(`/portal/carnegie-notes/packet/${letter.id}`, { cookie: A })).data, /Carnegie · Riley/, "no packet until approved again");
  assert.equal((await call(`/api/portal/carnegie-notes/letters/${letter.id}`, { method: "PATCH", cookie: A, body: { action: "report_delivery", version: letter.version, channel: "paper" } })).status, 400, "nothing is delivered before approval");

  response = await call(`/api/admin/carnegie-letters/${letter.id}`, { method: "POST", cookie: DIRECTOR, body: { action: "approve", version: letter.version } });
  letter = response.data.letter;
  response = await call(`/api/portal/carnegie-notes/letters/${letter.id}`, { method: "PATCH", cookie: A, body: { action: "mark_printed", version: letter.version } });
  assert.equal(response.data.letter.status, "printed");
  letter = response.data.letter;
  response = await call(`/api/portal/carnegie-notes/letters/${letter.id}`, { method: "PATCH", cookie: A, body: { action: "report_delivery", version: letter.version, channel: "email" } });
  assert.equal(response.data.letter.status, "delivery_reported");
  assert.equal(response.data.letter.delivery_channel, "email");
  letter = response.data.letter;
  assert.equal((await call(`/api/portal/carnegie-notes/letters/${letter.id}`, { method: "PATCH", cookie: A, body: { action: "save", version: letter.version, meaning_text: "changed", help_text: "x", recipient_name: "Aunt Fixture" } })).status, 400, "a delivered letter is final");

  const events = await db(`carnegie_student_letter_events?letter_id=eq.${letter.id}&order=id`);
  assert.deepEqual(events.map((event) => event.status), ["draft", "needs_review", "approved", "needs_review", "approved", "printed", "delivery_reported"]);
  assert.equal(new Set(events.map((event) => event.content_sha256)).size, 2, "two distinct approved texts");
});

test("reported gifts count nowhere until confirmed; confirm makes exactly one gift", { skip }, async () => {
  const before = (await call("/api/portal/carnegie-notes", { cookie: A })).data.students.find((s) => s.id === ids.studentA);
  assert.equal((await call("/api/portal/carnegie-notes/reported-gifts", { method: "POST", cookie: ANON, body: { student_id: ids.studentA, donor_name: "X", amount: "5", method: "cash" } })).status, 401);
  assert.equal((await call("/api/portal/carnegie-notes/reported-gifts", { method: "POST", cookie: B, body: { student_id: ids.studentA, donor_name: "X", amount: "5", method: "cash" } })).status, 404);
  const reported = await call("/api/portal/carnegie-notes/reported-gifts", { method: "POST", cookie: A, body: { student_id: ids.studentA, donor_name: "Neighbor Fixture", amount: "40", method: "cash", donor_email: "" } });
  assert.equal(reported.status, 201);
  const report = reported.data.report;

  const waiting = (await call("/api/portal/carnegie-notes", { cookie: A })).data.students.find((s) => s.id === ids.studentA);
  assert.equal(waiting.notesCents, before.notesCents, "raised through my notes is unchanged");
  assert.equal(waiting.pendingCents, before.pendingCents + 4000);
  assert.deepEqual(await db(`sponsor_gifts?portal_student_id=eq.${ids.studentA}&select=id`), [], "no gift exists yet");
  assert.ok(!(await call("/api/portal/carnegie-notes", { cookie: B })).data.students.some((s) => (s.reportedGifts || []).some((r) => r.id === report.id)), "B cannot view A's report");

  assert.equal((await call(`/api/admin/carnegie-reported-gifts/${report.id}`, { method: "POST", cookie: WORKER, body: { action: "confirm" } })).status, 403, "staff without the gift capability cannot confirm");
  const [one, two] = await Promise.all([
    call(`/api/admin/carnegie-reported-gifts/${report.id}`, { method: "POST", cookie: DIRECTOR, body: { action: "confirm" } }),
    call(`/api/admin/carnegie-reported-gifts/${report.id}`, { method: "POST", cookie: DIRECTOR, body: { action: "confirm" } })
  ]);
  assert.equal(one.status, 200);
  assert.equal(two.status, 200);
  const again = await call(`/api/admin/carnegie-reported-gifts/${report.id}`, { method: "POST", cookie: DIRECTOR, body: { action: "confirm" } });
  assert.equal(again.status, 200);
  assert.equal(again.data.alreadyConfirmed, true);
  const gifts = await db(`sponsor_gifts?portal_student_id=eq.${ids.studentA}&select=id,amount_cents,status,campaign_code,method,listed_on_site`);
  assert.equal(gifts.length, 1, "exactly one gift despite repeated clicks");
  assert.deepEqual({ ...gifts[0], id: undefined }, { id: undefined, amount_cents: 4000, status: "confirmed", campaign_code: "carnegie-2027", method: "cash", listed_on_site: false });
  const after = (await call("/api/portal/carnegie-notes", { cookie: A })).data.students.find((s) => s.id === ids.studentA);
  assert.equal(after.notesCents, before.notesCents + 4000);
  assert.equal(after.pendingCents, before.pendingCents);
});

test("adjust then confirm uses the confirmed amount; reject creates no gift", { skip }, async () => {
  const adjusted = (await call("/api/portal/carnegie-notes/reported-gifts", { method: "POST", cookie: A, body: { student_id: ids.studentA, donor_name: "Cousin Fixture", amount: "50", method: "check", check_number: "1001" } })).data.report;
  const confirmed = await call(`/api/admin/carnegie-reported-gifts/${adjusted.id}`, { method: "POST", cookie: DIRECTOR, body: { action: "confirm", amount: "45.00", method: "cash" } });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.data.report.reported_amount_cents, 5000);
  assert.equal(confirmed.data.report.confirmed_amount_cents, 4500);
  const [gift] = await db(`sponsor_gifts?id=eq.${confirmed.data.report.sponsor_gift_id}&select=amount_cents,method,status`);
  assert.deepEqual(gift, { amount_cents: 4500, method: "cash", status: "confirmed" });
  const trail = await db(`carnegie_reported_gift_events?reported_gift_id=eq.${adjusted.id}&order=id`);
  assert.deepEqual(trail.map((row) => [row.status, row.reported_amount_cents, row.confirmed_amount_cents, row.actor_type]), [["reported", 5000, null, "family"], ["confirmed", 5000, 4500, "staff"]]);
  assert.equal(trail[1].actor_id, ids.director);

  const rejected = (await call("/api/portal/carnegie-notes/reported-gifts", { method: "POST", cookie: A, body: { student_id: ids.studentA, donor_name: "Unknown Fixture", amount: "20", method: "cash" } })).data.report;
  assert.equal((await call(`/api/admin/carnegie-reported-gifts/${rejected.id}`, { method: "POST", cookie: DIRECTOR, body: { action: "reject", reason: "" } })).status, 400);
  const rejection = await call(`/api/admin/carnegie-reported-gifts/${rejected.id}`, { method: "POST", cookie: DIRECTOR, body: { action: "reject", reason: "No envelope arrived." } });
  assert.equal(rejection.data.report.status, "rejected");
  assert.equal(rejection.data.report.sponsor_gift_id, null);
  assert.equal((await call(`/api/admin/carnegie-reported-gifts/${rejected.id}`, { method: "POST", cookie: DIRECTOR, body: { action: "confirm" } })).status, 409, "a rejected report cannot be confirmed");
  const gifts = await db(`sponsor_gifts?portal_student_id=eq.${ids.studentA}&select=amount_cents`);
  assert.deepEqual(gifts.map((row) => row.amount_cents).sort(), [4000, 4500], "the rejected report made no gift");
});

test("the donor landing shows the chart only through the gate, with first-name preview metadata", { skip }, async () => {
  const response = await call(`/support/${codeA}/carnegie`, { cookie: DIRECTOR });
  const page = { ...response, data: response.data.replace(/<!-- -->/g, "") };
  assert.equal(page.status, 200);
  assert.match(page.data, /Riley invited you to help fill their music notes/);
  assert.match(page.data, /of \$500 in music notes/);
  assert.match(page.data, /property="og:title" content="Help Riley get to Carnegie Hall"/);
  assert.doesNotMatch(page.data.match(/<head>[\s\S]*<\/head>/)?.[0] || "", /Fixture|\$\d/, "no last name or amounts in metadata");
  const image = await call("/api/carnegie-notes/og", { cookie: DIRECTOR });
  assert.equal(image.status, 200);
  assert.match(image.headers.get("content-type"), /image\/png/);
});

test("with the gate unset, nothing new is reachable and the #103 route is unchanged", { skip: skip || (!OFF_BASE && "set CARNEGIE_LETTERS_E2E_OFF_BASE") }, async () => {
  for (const path of ["/portal/carnegie-notes", "/portal/carnegie-notes/letter", `/portal/carnegie-notes/packet/${letter?.id || crypto.randomUUID()}`, "/admin/carnegie-letters"]) {
    assert.equal((await call(path, { base: OFF_BASE, cookie: A })).status, 404, `${path} is 404`);
  }
  for (const [path, method] of [["/api/portal/carnegie-notes", "GET"], ["/api/portal/carnegie-notes/letters", "POST"], ["/api/portal/carnegie-notes/reported-gifts", "POST"], ["/api/admin/carnegie-letters", "GET"], ["/api/admin/carnegie-reported-gifts", "GET"], ["/api/admin/carnegie-expected-gifts", "GET"], ["/api/admin/carnegie-expected-gifts", "POST"], ["/api/carnegie-notes/og", "GET"]]) {
    assert.equal((await call(path, { base: OFF_BASE, method, cookie: A, body: method === "POST" ? {} : undefined })).status, 404, `${method} ${path} is 404`);
  }
  const landing = await call(`/support/${codeA}/carnegie`, { base: OFF_BASE, cookie: A });
  assert.equal(landing.status, 307);
  assert.match(landing.headers.get("location"), /^\/support-carnegie\?a=[^#]+#make-a-gift$/);
});

test("expected gifts stay pending and count nowhere until confirmed; confirm makes one gift; cancel makes none (#110)", { skip }, async () => {
  const before = (await call("/api/portal/carnegie-notes", { cookie: A })).data.students.find((s) => s.id === ids.studentA);
  const giftsBefore = await db(`sponsor_gifts?portal_student_id=eq.${ids.studentA}&select=id`);
  assert.equal((await call("/api/admin/carnegie-expected-gifts", { method: "POST", cookie: WORKER, body: {} })).status, 403, "gift-writing staff only");
  assert.equal((await call("/api/admin/carnegie-expected-gifts", { cookie: A.replace(/; ab_staff_session=.*/, "") })).status, 404, "a family session never reaches it");
  const make = async (extra) => (await call("/api/admin/carnegie-expected-gifts", { method: "POST", cookie: DIRECTOR, body: { donor_name: "Expected Fixture", amount: "2000", method: "employer_platform", platform: "Giving platform", gift_type: "employee_gift", gift_date: "2026-09-23", student_id: ids.studentA, designation: "Carnegie", ...extra } })).data.item;
  const one = await make();
  const two = await make({ donor_name: "Expected Fixture, employer match", gift_type: "employer_match" });
  assert.equal(one.status, "expected");
  const waiting = (await call("/api/portal/carnegie-notes", { cookie: A })).data.students.find((s) => s.id === ids.studentA);
  assert.equal(waiting.notesCents, before.notesCents, "raised through my notes unchanged");
  assert.equal(waiting.pendingCents, before.pendingCents + 400000, "shown as pending");
  assert.equal((await db(`sponsor_gifts?portal_student_id=eq.${ids.studentA}&select=id`)).length, giftsBefore.length, "no gift yet");

  const clicks = await Promise.all([1, 2, 3].map(() => call(`/api/admin/carnegie-expected-gifts/${one.id}`, { method: "POST", cookie: DIRECTOR, body: { action: "confirm", amount: "1990" } })));
  assert.ok(clicks.every((r) => r.status === 200));
  const created = await db(`sponsor_gifts?portal_student_id=eq.${ids.studentA}&select=id,amount_cents,method,status,campaign_code`);
  assert.equal(created.length, giftsBefore.length + 1, "exactly one gift from repeated clicks");
  assert.ok(created.some((g) => g.amount_cents === 199000 && g.method === "other" && g.status === "confirmed" && g.campaign_code === "carnegie-2027"));
  const cancelled = await call(`/api/admin/carnegie-expected-gifts/${two.id}`, { method: "POST", cookie: DIRECTOR, body: { action: "cancel", reason: "Match declined." } });
  assert.equal(cancelled.data.item.status, "cancelled");
  assert.equal((await call(`/api/admin/carnegie-expected-gifts/${two.id}`, { method: "POST", cookie: DIRECTOR, body: { action: "confirm" } })).status, 409);
  assert.equal((await db(`sponsor_gifts?portal_student_id=eq.${ids.studentA}&select=id`)).length, giftsBefore.length + 1, "cancel made no gift");
  const after = (await call("/api/portal/carnegie-notes", { cookie: A })).data.students.find((s) => s.id === ids.studentA);
  assert.equal(after.notesCents, before.notesCents + 199000);
  assert.equal(after.pendingCents, before.pendingCents);
  const trail = await db(`carnegie_expected_gift_events?expected_gift_id=eq.${one.id}&order=id&select=status,amount_cents,confirmed_amount_cents,actor`);
  assert.deepEqual(trail.map((r) => [r.status, r.amount_cents, r.confirmed_amount_cents]), [["expected", 200000, null], ["confirmed", 200000, 199000]]);
  assert.equal(trail[1].actor, `staff:${ids.director}`);
});
