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
