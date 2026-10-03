import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { hitRateLimit } from "../lib/rateLimitCore.mjs";
import { checkPortalCode } from "../lib/portalCodeCheck.mjs";
import { isVerifiedContact, personWithinActorStudents } from "../lib/portalPersonScope.mjs";

const source = (relativePath) => readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
const exists = (relativePath) => existsSync(new URL(`../${relativePath}`, import.meta.url));

// In-memory stand-in for the PostgREST builder calls these helpers make. Every awaited
// call yields to the event loop, so concurrent requests interleave as they would live.
function fakeDb(tables = {}) {
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  return {
    tables,
    from(name) {
      const rows = (tables[name] ||= []);
      const filters = [];
      let op = "select";
      let patch = null;
      let row = null;
      let returning = false;
      const match = (candidate) => filters.every((filter) => filter(candidate));
      const builder = {
        select() { if (op !== "select") returning = true; return builder; },
        eq(column, value) { filters.push((candidate) => candidate[column] === value); return builder; },
        is(column, value) { filters.push((candidate) => (candidate[column] ?? null) === value); return builder; },
        insert(value) { op = "insert"; row = value; return builder; },
        update(value) { op = "update"; patch = value; return builder; },
        async maybeSingle() {
          await tick();
          const found = rows.filter(match);
          return { data: found[0] ? { ...found[0] } : null, error: null };
        },
        then(resolve, reject) {
          return (async () => {
            await tick();
            if (op === "insert") {
              if (row.key !== undefined && rows.some((existing) => existing.key === row.key)) return { error: { code: "23505" } };
              rows.push({ ...row });
              return { error: null };
            }
            if (op === "update") {
              const hit = rows.filter(match);
              for (const target of hit) Object.assign(target, patch);
              return { data: returning ? hit.map((target) => ({ ...target })) : null, error: null };
            }
            return { data: rows.filter(match).map((target) => ({ ...target })), error: null };
          })().then(resolve, reject);
        }
      };
      return builder;
    }
  };
}

test("request counters admit at most the limit when hits arrive together", async () => {
  const db = fakeDb();
  const results = await Promise.all(
    Array.from({ length: 30 }, () => hitRateLimit(db, { key: "k", limit: 10, windowMs: 60_000 }))
  );
  const allowed = results.filter((result) => result.allowed).length;
  assert.ok(allowed >= 1 && allowed <= 10, `allowed ${allowed}`);
  assert.ok(db.tables.auth_rate_limits[0].count <= 10);
});

test("request counters count sequential hits and reset after the window", async () => {
  const db = fakeDb();
  const now = Date.parse("2026-10-03T08:00:00Z");
  const hits = [];
  for (let index = 0; index < 12; index += 1) hits.push(await hitRateLimit(db, { key: "k", limit: 10, windowMs: 60_000, now }));
  assert.equal(hits.filter((hit) => hit.allowed).length, 10);
  assert.equal((await hitRateLimit(db, { key: "k", limit: 10, windowMs: 60_000, now: now + 61_000 })).allowed, true);
});

test("request counters report database errors instead of allowing", async () => {
  const failing = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: "down" } }) }) }) }) };
  await assert.rejects(hitRateLimit(failing, { key: "k", limit: 1, windowMs: 1000 }));
  const wrapper = source("lib/rateLimit.js");
  assert.match(wrapper, /hitRateLimit\(supabaseAdmin/);
  assert.match(wrapper, /catch \{\s*return \{ allowed: failOpen/);
});

test("one-time codes allow at most the attempt limit of comparisons under a burst", async () => {
  const db = fakeDb({ portal_magic_links: [{ id: "L", code_attempts: 0, consumed_at: null }] });
  let comparisons = 0;
  const outcomes = await Promise.all(Array.from({ length: 40 }, () => checkPortalCode(db, { id: "L", code_attempts: 0 }, {
    maxAttempts: 5,
    matches: () => { comparisons += 1; return false; }
  })));
  assert.equal(outcomes.some(Boolean), false);
  assert.ok(comparisons <= 5, `compared ${comparisons}`);

  // Sequential wrong guesses lock the row at the limit; the right code then fails.
  const seq = fakeDb({ portal_magic_links: [{ id: "L", code_attempts: 0, consumed_at: null }] });
  for (let index = 0; index < 5; index += 1) {
    const [current] = seq.tables.portal_magic_links;
    assert.equal(await checkPortalCode(seq, { ...current }, { maxAttempts: 5, matches: () => false }), false);
  }
  assert.ok(seq.tables.portal_magic_links[0].consumed_at);
  assert.equal(await checkPortalCode(seq, { ...seq.tables.portal_magic_links[0] }, { maxAttempts: 5, matches: () => true }), false);
});

test("a correct one-time code is consumed once", async () => {
  const db = fakeDb({ portal_magic_links: [{ id: "L", code_attempts: 0, consumed_at: null }] });
  const first = await checkPortalCode(db, { id: "L", code_attempts: 0 }, { maxAttempts: 5, matches: () => true });
  assert.equal(first, true);
  assert.ok(db.tables.portal_magic_links[0].consumed_at);
  assert.equal(await checkPortalCode(db, { id: "L", code_attempts: 1 }, { maxAttempts: 5, matches: () => true }), false);
});

test("code-verify routes use the shared check and a closed request limit", () => {
  for (const route of ["app/api/portal/session/route.js", "app/api/portal/request/confirm/route.js"]) {
    const text = source(route);
    assert.match(text, /checkPortalCode\(supabaseAdmin/, route);
    assert.doesNotMatch(text, /code_attempts: attempts/, route);
    assert.match(text, /checkRateLimit\([^\n]*failOpen: false/, route);
  }
});

test("shared people stay editable only inside the editor's own students", () => {
  const actor = [
    { student_id: "S1", relationship_status: "trusted", assurance_level: "high" },
    { student_id: "S2", relationship_status: "trusted", assurance_level: "low" }
  ];
  assert.equal(personWithinActorStudents([{ student_id: "S1", relationship_status: "trusted" }], actor), true);
  assert.equal(personWithinActorStudents([
    { student_id: "S1", relationship_status: "trusted" },
    { student_id: "S9", relationship_status: "trusted" }
  ], actor), false);
  assert.equal(personWithinActorStudents([
    { student_id: "S1", relationship_status: "trusted" },
    { student_id: "S9", relationship_status: "claimed" }
  ], actor), false);
  assert.equal(personWithinActorStudents([
    { student_id: "S1", relationship_status: "trusted" },
    { student_id: "S9", relationship_status: "superseded" }
  ], actor), true);
  assert.equal(personWithinActorStudents([{ student_id: "S2", relationship_status: "trusted" }], actor), false);
  assert.equal(isVerifiedContact({ verification_status: "verified_email_code" }), true);
  assert.equal(isVerifiedContact({ verification_status: "unverified", verified_at: null }), false);
});

test("guardian edits and onboarding family saves check the shared-person scope", () => {
  const guardian = source("app/api/portal/guardian-request/route.js");
  const patch = guardian.slice(guardian.indexOf("export async function PATCH"), guardian.indexOf("export async function DELETE"));
  assert.match(patch, /personWithinActorFamily\(session\.personId, guardianId\)/);
  assert.ok(patch.indexOf("personWithinActorFamily") < patch.indexOf('.from("portal_people")\n    .update'));
  assert.match(patch, /isVerifiedContact\(existing\)/);
  const onboarding = source("app/api/portal/onboarding/route.js");
  assert.match(onboarding, /step === 3[\s\S]*scopeOnboardingGuardians\(authorization\.person\.id, studentId/);
  assert.ok(onboarding.indexOf("scopeOnboardingGuardians") < onboarding.indexOf('rpc("portal_save_onboarding_step"'));
});

test("business outreach email escapes family-entered text", async () => {
  const { renderColdEmailHTML } = await import("../lib/businessOutreachEmail.js");
  const html = renderColdEmailHTML({
    businessName: "Shore <img src=x onerror=alert(1)>",
    contactFirst: "<b>Pat</b>",
    yesUrl: "https://example.test/y?a=1&b=\"2\"",
    noUrl: "https://example.test/n"
  });
  assert.doesNotMatch(html, /<img|<b>/);
  assert.match(html, /Shore &lt;img/);
  assert.match(html, /a=1&amp;b=&quot;2&quot;/);
});

test("family-added businesses are bounded and marked family-sourced", () => {
  const text = source("app/api/sponsors/prospects/route.js");
  assert.match(text, /provenance: "family-sourced"/);
  assert.match(text, /boundedText\(body\.business_name, 160\)/);
  assert.match(text, /CONTROL_CHARACTERS/);
});

test("staff sign-in limits pair the address with the network and hide unknown addresses", () => {
  const text = source("app/api/sponsors/staff-auth/route.js");
  assert.match(text, /staff-auth:\$\{email\}:\$\{ip\}/);
  assert.match(text, /staff-auth-email:\$\{email\}/);
  assert.match(text, /verifyPin\(pin, data\?\.pin_hash \|\| unknownStaffPinHash\(\)\)/);
  assert.match(source("scripts/seed-staff.mjs"), /\\d\{6,8\}/);
});

test("shared PIN routes share one network limit and one closed overall limit", () => {
  const limiter = source("lib/rateLimit.js");
  assert.match(limiter, /shared-pin:global/);
  assert.match(limiter, /shared-pin:\$\{clientIp\(request\)\}/);
  for (const route of ["app/api/attendance/access/route.js", "app/api/regiment-os/access/route.js"]) {
    const text = source(route);
    assert.match(text, /checkSharedPinLimit\(request\)/, route);
    assert.ok(text.indexOf("checkSharedPinLimit") < text.indexOf("verifyPin("), route);
  }
});

test("shared PIN cookies stop working after the PIN changes", async () => {
  process.env.PORTAL_SESSION_SECRET = "test-secret";
  process.env.ATTENDANCE_PIN_HASH = "hash-one";
  const { createRegimentOsCookieValue, validateRegimentOsRequest } = await import("../lib/regimentOsAuth.js");
  const cookie = createRegimentOsCookieValue();
  const request = { cookies: { get: () => ({ value: cookie }) } };
  assert.equal(validateRegimentOsRequest(request), true);
  process.env.ATTENDANCE_PIN_HASH = "hash-two";
  assert.equal(validateRegimentOsRequest(request), false);
  assert.match(source("lib/attendanceAuth.js"), /payload\.pv === sharedPinVersion\(\)/);
});

test("access requests that send a code are limited per address and network", () => {
  const text = source("app/api/portal/request/route.js");
  assert.match(text, /portal-request:\$\{requesterEmail\}[^\n]*failOpen: false/);
  assert.match(text, /portal-request-ip:\$\{clientIp\(request\)\}[^\n]*failOpen: false/);
  assert.ok(text.indexOf("portal-request:") < text.indexOf('.from("portal_access_requests")'));
});

test("public source text carries case labels instead of names", () => {
  assert.doesNotMatch(source("app/api/marching-band-signup/route.js"), /\([A-Z][a-z]+ [A-Z][a-z]+ \+ stragglers\)/);
  assert.doesNotMatch(source("docs/decisions/2026-06-23-portal-parent-changes-auto-approve.md"), /stuck requests \([A-Z][a-z]+→/);
});

test("Band Ready summary sends are limited per student", () => {
  const text = source("app/api/portal/band-ready/route.js");
  const post = text.slice(text.indexOf("export async function POST"));
  assert.match(post, /band-ready-summary:\$\{studentId\}[^\n]*failOpen: false/);
  assert.ok(post.indexOf("band-ready-summary") < post.indexOf("sendBandReadySummaryEmail("));
});

test("sponsorship student access falls back to the stored student only for legacy PIN families", () => {
  assert.match(source("lib/sponsorStudentLinks.js"), /!studentIds\.length && !family\?\.portal_person_id && family\?\.portal_student_id/);
  const gifts = source("lib/sponsorGifts.js");
  assert.match(gifts, /family\?\.portal_person_id[\s\S]*relationship_status", "trusted"[\s\S]*if \(!trusted\) portalStudentId = null/);
});

test("family payments settle only on a completed capture", async () => {
  const { paypalCaptureCompleted, hasPaypalTransmissionHeaders } = await import("../lib/paypal.js");
  assert.equal(paypalCaptureCompleted({ status: "COMPLETED", captureStatus: "PENDING" }), false);
  assert.equal(paypalCaptureCompleted({ status: "COMPLETED", captureStatus: "COMPLETED" }), true);
  for (const route of ["app/api/billing/capture-order/route.js", "app/api/portal/clothing-order/capture/route.js"]) {
    const text = source(route);
    assert.match(text, /paypalCaptureCompleted\(detail\)/, route);
    assert.doesNotMatch(text, /detail\.status !== "COMPLETED"/, route);
  }
  const headers = {
    "paypal-auth-algo": "SHA256withRSA",
    "paypal-cert-url": "https://api.paypal.com/v1/notifications/certs/CERT",
    "paypal-transmission-id": "id",
    "paypal-transmission-sig": "sig",
    "paypal-transmission-time": "2026-10-03T08:00:00Z"
  };
  assert.equal(hasPaypalTransmissionHeaders(headers), true);
  assert.equal(hasPaypalTransmissionHeaders({ ...headers, "paypal-cert-url": "https://paypal.com.example.test/cert" }), false);
  assert.equal(hasPaypalTransmissionHeaders({ ...headers, "paypal-transmission-sig": null }), false);
  const webhook = source("app/api/billing/webhook/route.js");
  assert.ok(webhook.indexOf("hasPaypalTransmissionHeaders(headers)") < webhook.indexOf("verifyWebhookSignature({"));
});

test("fee capture rechecks the balance before taking money", () => {
  const text = source("app/api/billing/capture-order/route.js");
  assert.ok(text.indexOf("feeBalanceCents(payment.student_id, payment.category)") < text.indexOf("captureOrder(orderId)"));
});

test("clothing capture records failures and recovers an earlier capture", () => {
  const text = source("app/api/portal/clothing-order/capture/route.js");
  assert.match(text, /getOrder\(orderId\)/);
  assert.match(text, /const \{ error \} = await supabaseAdmin\.from\("portal_clothing_orders"\)\.update/);
  assert.match(text, /if \(error\) \{/);
});

test("refunds that do not match a payment are recorded for review", () => {
  const text = source("app/api/billing/webhook/route.js");
  assert.match(text, /action: "paypal_refund_unmatched"/);
  assert.doesNotMatch(text, /throw new Error\("PayPal family refund does not match/);
});

test("one-click answers use exact roster lookups and one answer for every id", () => {
  const text = source("app/api/confirm/route.js");
  assert.doesNotMatch(text, /\.ilike\(/);
  assert.match(text, /\.in\("school_email", emails\)/);
  assert.match(text, /isKnownStudent\(studentId\)\)\) \{[\s\S]*?return Response\.json\(\{ ok: true \}\);/);
});

test("the public assistant is limited per network and per day and hides provider errors", () => {
  const text = source("app/api/chat/route.js");
  assert.match(text, /chat:\$\{clientIp\(request\)\}[^\n]*failOpen: false/);
  assert.match(text, /chat:global:\$\{day\}[^\n]*failOpen: false/);
  assert.ok(text.indexOf("chat:${clientIp") < text.indexOf("api.anthropic.com"));
  assert.doesNotMatch(text, /message: detail|message: error\.message/);
});

test("withdrawn students drop out of Band Ready and instrument agreements", () => {
  const ready = source("app/api/portal/band-ready/route.js");
  assert.match(ready, /portal_students!inner\(/);
  assert.match(ready, /\.eq\("portal_students\.status", "active"\)/);
  assert.match(source("app/api/portal/instrument-request/route.js"), /portal_students!inner\(display_name,instrument_2026,status\)/);
});
