// #209: every staff address export drops opted-out addresses, and the new
// "Copy addresses" action matches resolveAudience. Real route handlers run
// against an in-memory database; nothing touches production.
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.PORTAL_SESSION_SECRET = "synthetic-test-signing-secret-only";

// "@/..." aliases resolve to the repo; supabaseAdmin and the heavy roster loader
// become stand-ins the tests control through globalThis.
const VIRTUAL = {
  "/lib/supabaseAdmin.js": "export const supabaseAdmin = { from: (table) => globalThis.__db.from(table) };",
  "/lib/currentStudents.js": "export const loadCurrentStudents = async () => ({ students: globalThis.__roster });",
};
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("virtual:")) return { url: specifier, shortCircuit: true };
    let spec = specifier;
    if (spec.startsWith("@/")) {
      const base = path.join(ROOT, spec.slice(2));
      spec = pathToFileURL(["", ".js", ".mjs"].map((ext) => base + ext).find((f) => existsSync(f) && statSync(f).isFile()) || base).href;
    } else if (spec === "next/server") spec = "next/server.js";
    const result = next(spec, context);
    const hit = Object.keys(VIRTUAL).find((suffix) => result.url.endsWith(suffix));
    return hit ? { url: `virtual:${hit}`, shortCircuit: true } : result;
  },
  load(url, context, next) {
    if (url.startsWith("virtual:")) return { format: "module", source: VIRTUAL[url.slice(8)], shortCircuit: true };
    return next(url, context);
  },
});

const { NextRequest } = await import("next/server.js");
const { createStaffCookieValue } = await import("../lib/staffAuthCookie.js");
const { createPortalSession } = await import("../lib/portalTokens.js");
const { resolveAudience, resolveAudienceAddresses } = await import("../lib/audience.js");
const { dropSuppressedFromStudents } = await import("../lib/contactSuppression.js");
const { loadMembershipContactEmails } = await import("../lib/programMemberships.js");
const copyRoute = await import("../app/api/admin/broadcast/copy-addresses/route.js");
const membershipRoute = await import("../app/api/admin/program-memberships/contacts/route.js");
const studentsRoute = await import("../app/api/admin/current-students/export/route.js");

// Minimal PostgREST stand-in. tables: { name: rows | Error }. Dotted filters
// follow embedded rows (program_groups.code). Inserts land in db.inserts.
function fakeDb(tables) {
  const db = { inserts: [] };
  const get = (row, field) => field.split(".").reduce((value, key) => value?.[key], row) ?? null;
  db.from = (table) => {
    const filters = [];
    let single = false;
    const run = () => {
      if (!(table in tables)) throw new Error(`Unexpected table ${table}`);
      const rows = tables[table];
      if (rows instanceof Error) return { data: null, error: rows };
      const data = rows.filter((row) => filters.every(([op, field, value]) => (op === "in" ? value.includes(get(row, field)) : get(row, field) === value)));
      return { data: single ? data[0] || null : data, error: null };
    };
    const query = {
      select: () => query,
      eq: (field, value) => { filters.push(["eq", field, value]); return query; },
      is: (field, value) => { filters.push(["is", field, value]); return query; },
      in: (field, values) => { filters.push(["in", field, values]); return query; },
      maybeSingle: () => { single = true; return query; },
      insert: (row) => { db.inserts.push({ table, row }); return Promise.resolve({ error: null }); },
      then: (resolve, reject) => Promise.resolve().then(run).then(resolve, reject),
    };
    return query;
  };
  return db;
}

const STAFF = { id: "00000000-0000-4000-8000-000000000001", role: "director", display_name: "Sample Director", session_token: "synthetic-director", disabled_at: null };
const SUPPRESSED = [{ contact_type: "email", value_normalized: "opted@example.test" }];
const trusted = (student_id, person_id) => ({ student_id, person_id, relationship_status: "trusted", assurance_level: "high", portal_people: { person_type: "guardian" } });
const email = (person_id, value, status = "verified_email_code") => ({ person_id, contact_type: "email", value_display: value, value_normalized: value.toLowerCase(), verification_status: status });

// Two marching students, one concert-only, one inactive. One guardian opted out
// (stored mixed case), one student school address opted out.
function fixture(overrides = {}) {
  return fakeDb({
    staff: [STAFF],
    portal_students: [
      { id: "s1", status: "active", school_email: "s1@example.test" },
      { id: "s2", status: "active", school_email: "OPTED@example.test" },
      { id: "s3", status: "active", school_email: "s3@example.test" },
      { id: "s4", status: "inactive", school_email: "s4@example.test" },
    ],
    program_memberships: [
      { student_id: "s1", ends_on: null, program_groups: { code: "marching", status: "active" } },
      { student_id: "s2", ends_on: null, program_groups: { code: "marching", status: "active" } },
      { student_id: "s3", ends_on: null, program_groups: { code: "concert", status: "active" } },
      { student_id: "s4", ends_on: null, program_groups: { code: "marching", status: "active" } },
    ],
    portal_student_people: [trusted("s1", "p1"), trusted("s1", "p2"), trusted("s2", "p2"), trusted("s3", "p3"), trusted("s4", "p4")],
    portal_contact_methods: [
      email("p1", "Opted@Example.TEST"),
      email("p2", "keep@example.test"),
      email("p3", "concert@example.test"),
      email("p4", "inactive@example.test"),
    ],
    contact_suppressions: SUPPRESSED,
    ...overrides,
  });
}

const MARCHING = { match: "all", predicates: [{ key: "program_group", op: "in", values: ["marching"] }] };
const staffCookie = () => `ab_staff_session=${createStaffCookieValue({ id: STAFF.id, token: STAFF.session_token })}`;
const familyCookie = () => `ab_portal_session=${createPortalSession({ personId: "p2", contactMethodId: "c2", email: "keep@example.test" })}`;
const post = (route, body, cookie) => route.POST(new NextRequest(`http://localhost${route === copyRoute ? "/api/admin/broadcast/copy-addresses" : "/api/admin/x"}`, {
  method: "POST",
  headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
  body: JSON.stringify(body),
}));
const lower = (list) => list.map((value) => value.toLowerCase()).sort();
const noAddresses = (db) => db.inserts.every(({ row }) => !JSON.stringify(row).includes("@"));

test("copy action returns exactly the resolveAudience recipient set for identical filters", async () => {
  for (const [filter, axis] of [[MARCHING, "guardians"], [MARCHING, "students"], [MARCHING, "both"], [{}, "both"]]) {
    globalThis.__db = fixture();
    const audience = await resolveAudience(filter, axis, globalThis.__db);
    const copy = await resolveAudienceAddresses(filter, axis, globalThis.__db);
    assert.deepEqual(copy.addresses, audience.recipients.map((row) => row.email), `${axis} parity`);
    assert.equal(copy.count, audience.count);
    assert.equal(copy.suppressedCount, audience.suppressedCount);
  }
  globalThis.__db = fixture();
  const copy = await resolveAudienceAddresses(MARCHING, "guardians", globalThis.__db);
  assert.deepEqual(copy.addresses, ["keep@example.test"], "inactive, other-group and opted-out guardians stay off");
  assert.equal(copy.suppressedCount, 1);
});

test("copy route refuses an anonymous request and a family session", async () => {
  for (const cookie of [null, familyCookie()]) {
    globalThis.__db = fixture();
    const response = await post(copyRoute, { audienceFilter: MARCHING, recipientAxis: "guardians" }, cookie);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).addresses, undefined);
    assert.equal(globalThis.__db.inserts.length, 0);
  }
});

test("copy route returns the filtered slice, deduped, and writes one audit row without addresses", async () => {
  globalThis.__db = fixture();
  const response = await post(copyRoute, { audienceFilter: MARCHING, recipientAxis: "both" }, staffCookie());
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
  const body = await response.json();
  assert.deepEqual(lower(body.addresses), ["keep@example.test", "s1@example.test"]);
  assert.equal(body.count, 2);
  assert.equal(body.suppressedCount, 1);
  const audits = globalThis.__db.inserts.filter(({ table }) => table === "audit_log");
  assert.equal(audits.length, 1);
  assert.equal(audits[0].row.action, "copy_audience_addresses");
  assert.equal(audits[0].row.actor_id, STAFF.id);
  assert.deepEqual(audits[0].row.changes, { audience_filter: MARCHING, recipient_axis: "both", recipient_count: 2, suppressed_count: 1 });
  assert.ok(noAddresses(globalThis.__db), "audit row carries no addresses");
});

test("copy route fails closed when the suppression lookup fails", async () => {
  globalThis.__db = fixture({ contact_suppressions: new Error("down") });
  const response = await post(copyRoute, { audienceFilter: MARCHING, recipientAxis: "both" }, staffCookie());
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.addresses, undefined);
  assert.equal(globalThis.__db.inserts.length, 0);
});

test("program-memberships contacts drop a suppressed address in any case and fail closed", async () => {
  globalThis.__db = fixture();
  const lib = await loadMembershipContactEmails(["s1", "s2"], "both", globalThis.__db);
  assert.deepEqual(lower(lib.emails), ["keep@example.test", "s1@example.test"]);
  assert.equal(lib.suppressedCount, 1);

  globalThis.__db = fixture();
  const response = await post(membershipRoute, { studentIds: ["s1", "s2"], audience: "both" }, staffCookie());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(lower(body.emails), ["keep@example.test", "s1@example.test"]);
  assert.equal(body.suppressedCount, 1);
  assert.equal(globalThis.__db.inserts.filter(({ table }) => table === "audit_log").length, 1);
  assert.ok(noAddresses(globalThis.__db));

  globalThis.__db = fixture({ contact_suppressions: new Error("down") });
  await assert.rejects(loadMembershipContactEmails(["s1"], "both", globalThis.__db), /Contact suppression lookup failed/);
  const failed = await post(membershipRoute, { studentIds: ["s1"], audience: "both" }, staffCookie());
  assert.equal(failed.status, 500);
  assert.equal((await failed.json()).emails, undefined);
  assert.equal(globalThis.__db.inserts.length, 0);
});

const ROSTER = [
  { id: "s1", displayName: "Student One", legalName: "", grade: "", ensembles: [], programInstrument: "", schoolEmail: "s1@example.test", personalEmail: "Opted@EXAMPLE.test", mobile: "", guardians: [{ name: "Guardian A", emails: ["OPTED@example.test", "keep@example.test"], phones: [] }] },
  { id: "s2", displayName: "Student Two", legalName: "", grade: "", ensembles: [], programInstrument: "", schoolEmail: "s2@example.test", personalEmail: "", mobile: "", guardians: [] },
];

test("current-students copy and CSV drop a suppressed address in any case and fail closed", async () => {
  globalThis.__roster = ROSTER;
  const helper = await dropSuppressedFromStudents(ROSTER, fixture());
  assert.equal(helper.students[0].personalEmail, "");
  assert.deepEqual(helper.students[0].guardians[0].emails, ["keep@example.test"]);
  assert.equal(helper.students[0].schoolEmail, "s1@example.test");
  assert.equal(helper.suppressedCount, 1);

  globalThis.__db = fixture();
  const copy = await post(studentsRoute, { studentIds: ["s1", "s2"], axis: "both" }, staffCookie());
  assert.equal(copy.status, 200);
  const copied = await copy.json();
  assert.deepEqual(lower(copied.emails), ["keep@example.test", "s1@example.test", "s2@example.test"]);
  assert.equal(copied.suppressedCount, 1);

  globalThis.__db = fixture();
  const csv = await (await post(studentsRoute, { studentIds: ["s1", "s2"], format: "csv" }, staffCookie())).json();
  assert.doesNotMatch(csv.csv, /opted@/i);
  assert.match(csv.csv, /keep@example\.test/);
  assert.equal(csv.suppressedCount, 1);
  assert.ok(noAddresses(globalThis.__db));

  globalThis.__db = fixture({ contact_suppressions: new Error("down") });
  for (const format of ["emails", "csv"]) {
    const failed = await post(studentsRoute, { studentIds: ["s1"], format }, staffCookie());
    assert.equal(failed.status, 503);
    const body = await failed.json();
    assert.equal(body.emails, undefined);
    assert.equal(body.csv, undefined);
  }
  assert.equal(globalThis.__db.inserts.length, 0);

  globalThis.__db = fixture();
  assert.equal((await post(studentsRoute, { studentIds: ["s1"] }, null)).status, 401);
  assert.equal((await post(membershipRoute, { studentIds: ["s1"], audience: "both" }, familyCookie())).status, 401);
});
