// #200 per-student Carnegie link block in broadcasts and the card PNG route. Synthetic data only.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

process.env.NEXT_PUBLIC_SUPABASE_URL ||= "http://127.0.0.1:9";
process.env.SUPABASE_SECRET_KEY ||= "test-only";
process.env.PORTAL_SESSION_SECRET ||= "carnegie-link-test-secret";

const { studentsByGuardianEmail } = await import("../lib/mediaConsent.mjs");
const { CARNEGIE_LINK_FALLBACK } = await import("../lib/carnegieLink.mjs");
const { carnegieStudentFullUrl } = await import("../lib/carnegieLetters.mjs");
const { bodyToHtml, personalizeForRecipient } = await import("../lib/broadcast.js");

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const SITE = "https://ashleybands.com";
const BODY = bodyToHtml("Hello Ashley Band families,\n\nSave this picture.\n\n{{carnegie_link}}\n\nKeep {{other_thing}} as is.\n\nThanks!\nMr. Parker");

const context = {
  byEmail: studentsByGuardianEmail([
    { student_id: A, email: "One@Example.test" },
    { student_id: A, email: "two@example.test" },
    { student_id: B, email: "TWO@example.test" },
    { student_id: C, email: "three@example.test" },
  ]),
  names: new Map([[A, "Avery"], [B, "Blake"], [C, "Casey"]]),
  codes: new Map([[A, "SynthCodeAAA"], [B, "SynthCodeBBB"]]),
};

const cards = (html) => [...html.matchAll(/<img src="([^"]+)"/g)].map((m) => m[1]);
const buttons = (html) => [...html.matchAll(/<a href="([^"]+)" style="[^"]*">Open/g)].map((m) => m[1]);

test("guardian with one student gets one card and one button for that student", () => {
  const out = personalizeForRecipient(BODY, { email: "one@example.test", person_id: "p1", student_id: A }, context, SITE);
  assert.equal(out.kind, "guardian");
  assert.deepEqual(cards(out.html), [`${SITE}/support/SynthCodeAAA/carnegie/card.png`]);
  assert.deepEqual(buttons(out.html), ["https://ashleybands.com/support/SynthCodeAAA/carnegie"]);
  assert.match(out.html, /Help Avery get to Carnegie Hall/);
  assert.match(out.html, /Open Avery&#39;s Carnegie page/);
  assert.doesNotMatch(out.html, /\{\{carnegie_link\}\}|\$\d/);
  assert.ok(out.html.indexOf("Save this picture") < out.html.indexOf("Avery"), "block sits where the placeholder was");
  assert.doesNotMatch(out.html, new RegExp(CARNEGIE_LINK_FALLBACK));
  assert.match(out.text, /Help Avery get to Carnegie Hall\nhttps:\/\/ashleybands\.com\/support\/SynthCodeAAA\/carnegie\n/);
  assert.match(out.text, /QR card to save: https:\/\/ashleybands\.com\/support\/SynthCodeAAA\/carnegie\/card\.png/);
  assert.doesNotMatch(out.text, /\{\{carnegie_link\}\}|<img/);
});

test("guardian with two students gets two blocks, one per student", () => {
  const out = personalizeForRecipient(BODY, { email: "two@example.test", person_id: "p2", student_id: A }, context, SITE);
  assert.deepEqual(cards(out.html), [`${SITE}/support/SynthCodeAAA/carnegie/card.png`, `${SITE}/support/SynthCodeBBB/carnegie/card.png`]);
  assert.deepEqual(buttons(out.html), [carnegieStudentFullUrl("SynthCodeAAA"), carnegieStudentFullUrl("SynthCodeBBB")]);
  assert.match(out.text, /Avery[\s\S]*SynthCodeAAA[\s\S]*Blake[\s\S]*SynthCodeBBB/);
});

test("a student recipient gets their own card", () => {
  const out = personalizeForRecipient(BODY, { email: "kid@student.example.test", person_id: null, student_id: B }, context, SITE);
  assert.equal(out.kind, "student");
  assert.deepEqual(cards(out.html), [`${SITE}/support/SynthCodeBBB/carnegie/card.png`]);
  assert.match(out.html, /Help Blake get to Carnegie Hall/);
  assert.doesNotMatch(out.html, /Avery/);
});

test("no linked student, or a student with no code: fallback line, never an image", () => {
  for (const row of [
    { email: "nobody@example.test", person_id: "p9", student_id: A },
    { email: "three@example.test", person_id: "p3", student_id: C },
    { email: "kid@student.example.test", person_id: null, student_id: "44444444-4444-4444-8444-444444444444" },
  ]) {
    const out = personalizeForRecipient(BODY, row, context, SITE);
    assert.deepEqual(cards(out.html), [], row.email);
    assert.match(out.html, new RegExp(`<p>${CARNEGIE_LINK_FALLBACK}</p>`));
    assert.match(out.text, new RegExp(CARNEGIE_LINK_FALLBACK));
    assert.doesNotMatch(out.html, /\{\{carnegie_link\}\}/);
  }
});

test("a guardian with one coded and one uncoded student gets one card and the fallback line", () => {
  const mixed = { ...context, byEmail: studentsByGuardianEmail([{ student_id: A, email: "mix@example.test" }, { student_id: C, email: "mix@example.test" }]) };
  const out = personalizeForRecipient(BODY, { email: "mix@example.test", person_id: "p4", student_id: A }, mixed, SITE);
  assert.equal(cards(out.html).length, 1);
  assert.match(out.html, new RegExp(CARNEGIE_LINK_FALLBACK));
});

test("unknown placeholders are left untouched in HTML and text", () => {
  const out = personalizeForRecipient(BODY, { email: "one@example.test", person_id: "p1", student_id: A }, context, SITE);
  assert.match(out.html, /Keep \{\{other_thing\}\} as is\./);
  assert.match(out.text, /Keep \{\{other_thing\}\} as is\./);
});

test("both placeholders in one body: each block lands with its own text links", () => {
  const body = bodyToHtml("Hi.\n\n{{media_consent}}\n\n{{carnegie_link}}\n\nBye.");
  const out = personalizeForRecipient(body, { email: "one@example.test", person_id: "p1", student_id: A }, context, SITE);
  assert.match(out.html, /media-consent\?t=/);
  assert.equal(cards(out.html).length, 1);
  assert.match(out.text, /media-consent\?t=.+&a=yes/);
  assert.match(out.text, /SynthCodeAAA\/carnegie\/card\.png/);
  assert.doesNotMatch(out.text, /PLACEHOLDERTEXTBLOCK/);
});

test("names are escaped in the HTML block", () => {
  const odd = { ...context, names: new Map([[A, "<b>Avery"]]) };
  const out = personalizeForRecipient(BODY, { email: "one@example.test", person_id: "p1", student_id: A }, odd, SITE);
  assert.doesNotMatch(out.html, /<b>Avery/);
  assert.match(out.html, /&lt;b&gt;Avery/);
});

test("dispatch personalizes for either placeholder; other broadcasts are sent unchanged", () => {
  const dispatch = readFileSync("lib/broadcast.js", "utf8");
  assert.match(dispatch, /hasPersonalPlaceholder\(broadcast\.body_html\)/);
  assert.match(dispatch, /html: personal \? personal\.html : broadcast\.body_html/);
});

test("card route: QR encodes the Music Notes link, first name only, 404 and noindex", () => {
  const route = readFileSync("app/support/[code]/carnegie/card.png/route.js", "utf8");
  assert.match(route, /QRCode\.toString\(carnegieStudentFullUrl\(resolved\.link\.code\)/);
  assert.match(route, /if \(!resolved\) return new Response\("Not found", \{ status: 404/);
  assert.match(route, /X-Robots-Tag": "noindex/);
  assert.doesNotMatch(route, /notesCents|amount_cents|confirmedNotesCents|legal_last|portal_name/);
  const notes = readFileSync("app/portal/carnegie-notes/CarnegieNotesClient.jsx", "utf8");
  assert.match(notes, /carnegieStudentFullUrl\(/, "Music Notes QR uses the same full link");
  assert.equal(carnegieStudentFullUrl("SynthCodeAAA"), "https://ashleybands.com/support/SynthCodeAAA/carnegie");
});
