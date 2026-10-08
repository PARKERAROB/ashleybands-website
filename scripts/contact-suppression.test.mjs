// #188: one opt-out list, checked before every email send.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { dropSuppressed } from "../lib/contactSuppression.js";
import { resolveAudience } from "../lib/audience.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(ROOT, file), "utf8");

// Minimal PostgREST stand-in. tables: { name: rows | Error }.
function fakeClient(tables, seen = []) {
  return {
    from(table) {
      const filters = [];
      const query = {
        select() { return query; },
        eq(field, value) { filters.push(["eq", field, value]); return query; },
        in(field, values) { filters.push(["in", field, values]); return query; },
        is(field, value) { filters.push(["is", field, value]); return query; },
        then(resolve, reject) {
          seen.push([table, filters]);
          if (!(table in tables)) throw new Error(`Unexpected table ${table}`);
          const rows = tables[table];
          if (rows instanceof Error) return Promise.resolve({ data: null, error: rows }).then(resolve, reject);
          const matches = rows.filter((row) => filters.every(([op, field, value]) =>
            op === "eq" ? row[field] === value : op === "in" ? value.includes(row[field]) : row[field] === value));
          return Promise.resolve({ data: matches, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
}

const SUPPRESSED = [{ contact_type: "email", value_normalized: "opted@example.test" }];

test("helper drops a suppressed address in any letter case and keeps the rest", async () => {
  const seen = [];
  const client = fakeClient({ contact_suppressions: SUPPRESSED }, seen);
  const { kept, suppressedCount } = await dropSuppressed(
    ["Opted@Example.TEST", " OPTED@example.test ", "keep@example.test", { email: "opted@EXAMPLE.test", id: 1 }, { email: "Keep2@Example.test", id: 2 }],
    client,
  );
  assert.deepEqual(kept, ["keep@example.test", { email: "Keep2@Example.test", id: 2 }]);
  assert.equal(suppressedCount, 1, "count is distinct addresses");
  const lookedUp = seen[0][1].find(([op]) => op === "in")[2];
  assert.ok(lookedUp.every((value) => value === value.toLowerCase().trim()), "lookup uses normalized values");
});

test("helper leaves everything when nothing is suppressed", async () => {
  const { kept, suppressedCount } = await dropSuppressed(["a@example.test", "b@example.test"], fakeClient({ contact_suppressions: [] }));
  assert.deepEqual(kept, ["a@example.test", "b@example.test"]);
  assert.equal(suppressedCount, 0);
});

test("helper throws when the lookup errors, so nothing sends unfiltered", async () => {
  await assert.rejects(
    dropSuppressed(["a@example.test"], fakeClient({ contact_suppressions: new Error("boom") })),
    /Contact suppression lookup failed/,
  );
});

test("a suppressed address on a trusted guardian link with a live contact is excluded from the audience", async () => {
  const client = fakeClient({
    portal_students: [{ id: "s1", status: "active", school_email: "student@example.test" }],
    portal_student_people: [
      { student_id: "s1", person_id: "p-opted", relationship_status: "trusted", portal_people: { person_type: "guardian" } },
      { student_id: "s1", person_id: "p-keep", relationship_status: "trusted", portal_people: { person_type: "guardian" } },
    ],
    portal_contact_methods: [
      { person_id: "p-opted", contact_type: "email", value_display: "Opted@Example.test", value_normalized: "opted@example.test", verification_status: "verified_email_code" },
      { person_id: "p-keep", contact_type: "email", value_display: "keep@example.test", value_normalized: "keep@example.test", verification_status: "verified_email_code" },
    ],
    contact_suppressions: SUPPRESSED,
  });
  const audience = await resolveAudience({}, "both", client);
  const emails = audience.recipients.map((row) => row.email.toLowerCase());
  assert.ok(!emails.includes("opted@example.test"));
  assert.deepEqual(emails.sort(), ["keep@example.test", "student@example.test"]);
  assert.equal(audience.suppressedCount, 1);
  assert.equal(audience.count, 2);
});

test("audience resolution fails, not sends, when the suppression lookup fails", async () => {
  const client = fakeClient({
    portal_students: [{ id: "s1", status: "active", school_email: "student@example.test" }],
    portal_student_people: [],
    portal_contact_methods: [],
    contact_suppressions: new Error("down"),
  });
  await assert.rejects(resolveAudience({}, "students", client), /Contact suppression lookup failed/);
});

// Grep-backed guard: the provider is reachable from exactly one function, and that
// function filters before it sends. A new provider call anywhere else fails here.
function sourceFiles(dir) {
  return readdirSync(path.join(ROOT, dir)).flatMap((name) => {
    const rel = path.join(dir, name);
    if (statSync(path.join(ROOT, rel)).isDirectory()) return sourceFiles(rel);
    return /\.(m?js|jsx)$/.test(name) && !/\.test\.mjs$/.test(name) ? [rel] : [];
  });
}

test("the only email provider call is the filtered one in lib/portalEmail.js", () => {
  const PROVIDER = /from\s+["']resend["']|new\s+Resend\s*\(|\.emails\.send\s*\(|api\.resend\.com|\.batch\.send\s*\(/;
  const hits = ["app", "lib", "scripts", "components"].flatMap(sourceFiles).filter((file) => PROVIDER.test(read(file)));
  assert.deepEqual(hits, ["lib/portalEmail.js"], "a new send path must go through sendPortalEmail");

  const email = read("lib/portalEmail.js");
  assert.equal(email.match(/\.emails\.send\s*\(/g).length, 1);
  const fn = email.slice(email.indexOf("async function sendPortalEmail("));
  const body = fn.slice(0, fn.indexOf("\n}\n"));
  assert.ok(body.indexOf("dropSuppressed(") > -1 && body.indexOf("dropSuppressed(") < body.indexOf(".emails.send("), "filter runs before the provider");
  assert.match(body, /to:\s*kept/, "only filtered recipients reach the provider");
});

test("each named send path routes through the helper", () => {
  assert.match(read("lib/audience.js"), /await dropSuppressed\(parts, client\)/, "resolveAudience filters");
  for (const file of ["lib/broadcast.js", "lib/newsletter.js", "scripts/media-consent.mjs", "lib/businessOutreachSend.js"]) {
    assert.match(read(file), /import \{[^}]*sendBroadcastEmail[^}]*\} from ["'](\.\.?\/lib\/|\.\/|@\/lib\/)portalEmail(\.js)?["']/, `${file} sends via portalEmail`);
  }
  assert.match(read("app/api/admin/broadcast/send/route.js"), /from "@\/lib\/broadcast"/, "send route dispatches via lib/broadcast");
  assert.match(read("app/api/admin/broadcast/send/route.js"), /resolveAudience\(/, "send route resolves a filtered audience");
});

// #190: the opt-out bypass is pinned to the two self-requested emails by name.
test("requestedByRecipient appears only in the sign-in code and receipt sends", () => {
  const files = ["app", "lib", "scripts", "components"].flatMap(sourceFiles).filter((file) => /requestedByRecipient/.test(read(file)));
  assert.deepEqual(files, ["lib/portalEmail.js"], "no other file may pass the bypass flag");
  const email = read("lib/portalEmail.js");
  const fnOf = (index) => [...email.slice(0, index).matchAll(/function (\w+)\(/g)].pop()[1];
  const uses = [...email.matchAll(/requestedByRecipient: true/g)].map((m) => fnOf(m.index));
  assert.deepEqual(uses.sort(), ["sendFeePaymentReceiptEmail", "sendPortalCodeEmail"]);
  assert.match(email, /requestedByRecipient = false/, "the default stays filtered");
  assert.match(email, /requestedByRecipient === true \?/, "only an explicit true bypasses");
});

test("broadcast and sponsor outreach count send-time skips as skipped", () => {
  for (const file of ["lib/broadcast.js", "lib/businessOutreachSend.js"]) {
    const source = read(file);
    assert.match(source, /const update = sendFailureUpdate\(err\);/, file);
    assert.match(source, /if \(update\.send_status === "skipped"\) skipped \+= 1;\s*else failed \+= 1;/, file);
    assert.match(source, /return \{ sent, failed, skipped, remaining/, file);
  }
});
