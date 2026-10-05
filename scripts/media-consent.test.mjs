// #162 media interview permission: tokens, per-recipient block, latest answer wins.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

process.env.NEXT_PUBLIC_SUPABASE_URL ||= "http://127.0.0.1:9";
process.env.SUPABASE_SECRET_KEY ||= "test-only";
process.env.PORTAL_SESSION_SECRET = "media-consent-test-secret";

const {
  isAutomatedAgent,
  latestAnswers,
  lookupOrRecordConsent,
  mediaConsentToken,
  studentsByGuardianEmail,
  verifyMediaConsentToken,
} = await import("../lib/mediaConsent.mjs");
const { bodyToHtml, personalizeForRecipient } = await import("../lib/broadcast.js");

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const BODY = bodyToHtml("Hello Ashley Band families,\n\nClick Yes below.\n\n{{media_consent}}\n\nThanks!\nMr. Parker");

const context = {
  byEmail: studentsByGuardianEmail([
    { student_id: A, email: "One@Example.test" },
    { student_id: A, email: "two@example.test" },
    { student_id: B, email: "TWO@example.test" },
  ]),
  names: new Map([[A, "Avery"], [B, "Blake"]]),
};

function linkTokens(html, answer) {
  return [...html.matchAll(new RegExp(`media-consent\\?t=([^&"]+)&amp;a=${answer}`, "g"))].map((m) => decodeURIComponent(m[1]));
}

test("token verifies only for its own student and rejects tampering", () => {
  const token = mediaConsentToken(A);
  assert.equal(verifyMediaConsentToken(token), A);
  assert.equal(verifyMediaConsentToken(token.replace(A, B)), null, "swapping the student id must fail");
  assert.equal(verifyMediaConsentToken(`${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`), null);
  assert.equal(verifyMediaConsentToken(A), null);
  assert.equal(verifyMediaConsentToken("preview"), null);
  assert.equal(verifyMediaConsentToken(`${token}.x`), null);
  assert.equal(verifyMediaConsentToken(mediaConsentToken(A, "other-secret")), null);
});

test("guardian with one student gets one Yes/No pair for that student", () => {
  const out = personalizeForRecipient(BODY, { email: "one@example.test", person_id: "p1", student_id: A }, context, "https://ashleybands.com");
  assert.equal(out.kind, "guardian");
  assert.deepEqual(linkTokens(out.html, "yes").map((t) => verifyMediaConsentToken(t)), [A]);
  assert.deepEqual(linkTokens(out.html, "no").map((t) => verifyMediaConsentToken(t)), [A]);
  assert.match(out.html, /Yes, Avery may be interviewed/);
  assert.doesNotMatch(out.html, /\{\{media_consent\}\}/);
  assert.ok(out.html.indexOf("Click Yes below") < out.html.indexOf("Avery"), "block sits where the placeholder was");
  assert.match(out.text, /https:\/\/ashleybands\.com\/media-consent\?t=.+&a=yes/, "text version keeps the link URLs");
});

test("guardian with two students gets links for both even though the recipient row names one", () => {
  const out = personalizeForRecipient(BODY, { email: "two@example.test", person_id: "p2", student_id: A }, context);
  const yes = linkTokens(out.html, "yes").map((t) => verifyMediaConsentToken(t));
  const no = linkTokens(out.html, "no").map((t) => verifyMediaConsentToken(t));
  assert.deepEqual(yes, [A, B]);
  assert.deepEqual(no, [A, B]);
  assert.match(out.html, /Avery[\s\S]*Blake/);
});

test("student recipients get the same email with no consent links", () => {
  const out = personalizeForRecipient(BODY, { email: "kid@student.example.test", person_id: null, student_id: A }, context);
  assert.equal(out.kind, "student");
  assert.doesNotMatch(out.html, /media-consent/);
  assert.match(out.html, /Your parent or guardian received a link to answer this\./);
  assert.match(out.html, /Hello Ashley Band families/);
});

test("latest answer wins: Yes then No reads as No", () => {
  const latest = latestAnswers([
    { student_id: A, answer: "yes", created_at: "2026-10-02T18:00:00.000000+00:00" },
    { student_id: A, answer: "no", created_at: "2026-10-02T18:05:00.000000+00:00" },
    { student_id: B, answer: "yes", created_at: "2026-10-02T18:01:00.000000+00:00" },
  ]);
  assert.equal(latest.get(A).answer, "no");
  assert.equal(latest.get(B).answer, "yes");
});

test("route rejects bad tokens with the family error and never records for bots", () => {
  const route = readFileSync("app/api/media-consent/route.js", "utf8");
  assert.match(route, /if \(!studentId\) return familyError\("invalid token", 400\)/);
  assert.match(route, /isAutomatedAgent\(userAgent\)\) return familyError/);
  assert.match(readFileSync("lib/mediaConsent.mjs", "utf8"), /status !== "active"/);
  assert.ok(isAutomatedAgent("Mozilla/5.0 HeadlessChrome/120"));
  assert.ok(isAutomatedAgent(""));
  assert.ok(!isAutomatedAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"));
});

test("broadcasts without the placeholder are sent unchanged", () => {
  const dispatch = readFileSync("lib/broadcast.js", "utf8");
  assert.match(dispatch, /hasMediaConsentPlaceholder\(broadcast\.body_html\)/);
  assert.match(dispatch, /html: personal \? personal\.html : broadcast\.body_html/);
});

// Fake Supabase client: one portal student, records every insert.
function fakeDb(student = { id: A, preferred_first: "Avery", status: "active" }) {
  const inserts = [];
  const db = {
    from(table) {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: student, error: null }),
        insert: async (row) => {
          inserts.push({ table, row });
          return { error: null };
        },
      };
      return query;
    },
  };
  return { db, inserts };
}

test("#177 opening the link (lookup with no answer) records nothing", async () => {
  const { db, inserts } = fakeDb();
  assert.deepEqual(await lookupOrRecordConsent(db, A), { firstName: "Avery" });
  assert.equal(inserts.length, 0);
});

test("#177 a button press records one email_link answer", async () => {
  const { db, inserts } = fakeDb();
  const out = await lookupOrRecordConsent(db, A, { answer: "no", userAgent: "Mozilla/5.0 (iPhone)" });
  assert.equal(out.firstName, "Avery");
  assert.deepEqual(inserts, [{ table: "media_consent_responses", row: { student_id: A, answer: "no", source: "email_link", user_agent: "Mozilla/5.0 (iPhone)" } }]);
});

test("#177 inactive students are refused and nothing is recorded", async () => {
  const { db, inserts } = fakeDb({ id: A, status: "inactive" });
  assert.equal((await lookupOrRecordConsent(db, A, { answer: "yes" })).status, 400);
  assert.equal(inserts.length, 0);
});

test("#177 the page only POSTs from a button press; GET lookup never writes", () => {
  const client = readFileSync("app/media-consent/MediaConsentClient.jsx", "utf8");
  const effect = client.slice(client.indexOf("useEffect(() =>"), client.indexOf("async function record("));
  assert.ok(effect.length > 0 && !/POST|a: /.test(effect), "the load effect must not send an answer");
  assert.match(client, /onClick=\{\(\) => record\(choice\.answer\)\}/);
  assert.equal((client.match(/method: "POST"/g) || []).length, 1);
  const route = readFileSync("app/api/media-consent/route.js", "utf8");
  const getHandler = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
  assert.match(getHandler, /lookupOrRecordConsent\(supabaseAdmin, studentId\)/, "GET passes no answer");
  assert.doesNotMatch(getHandler, /insert|answer/);
});
