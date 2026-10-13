import test from "node:test";
import assert from "node:assert/strict";
import { findPersonByEmail } from "../lib/portalPersonByEmail.mjs";

// Minimal PostgREST-shaped fake: applies eq/not-in/in filters and created_at order.
function fakeClient(tables) {
  return {
    from(name) {
      let rows = [...(tables[name] || [])];
      const q = {
        select: () => q,
        eq: (k, v) => ((rows = rows.filter((r) => r[k] === v)), q),
        in: (k, vs) => ((rows = rows.filter((r) => vs.includes(r[k]))), q),
        not: (k, _op, list) => {
          const bad = list.replace(/[()]/g, "").split(",");
          rows = rows.filter((r) => !bad.includes(r[k]));
          return q;
        },
        order: (k) => ((rows = rows.sort((a, b) => a[k].localeCompare(b[k]))), q),
        then: (resolve) => resolve({ data: rows, error: null })
      };
      return q;
    }
  };
}

const email = "family@example.com";
const contact = (id, person_id, created_at, verification_status = "verified_email_code") => ({
  id, person_id, created_at, verification_status, contact_type: "email", value_normalized: email,
  portal_people: { person_type: "guardian" }
});

test("unknown email resolves to nobody", async () => {
  assert.equal(await findPersonByEmail(fakeClient({}), email), null);
});

test("prefers the person with a trusted student link over an older empty one", async () => {
  const client = fakeClient({
    portal_contact_methods: [contact("c-old", "p-old", "2026-07-01"), contact("c-new", "p-new", "2026-10-10")],
    portal_student_people: [
      { person_id: "p-old", relationship_status: "superseded" },
      { person_id: "p-new", relationship_status: "trusted" }
    ]
  });
  assert.deepEqual(await findPersonByEmail(client, email), { contactId: "c-new", personId: "p-new", personType: "guardian" });
});

test("falls back to the oldest person and skips superseded contacts", async () => {
  const client = fakeClient({
    portal_contact_methods: [
      contact("c-dead", "p-dead", "2026-06-01", "superseded"),
      contact("c-b", "p-b", "2026-09-01"),
      contact("c-a", "p-a", "2026-08-01")
    ],
    portal_student_people: [{ person_id: "p-dead", relationship_status: "trusted" }]
  });
  assert.equal((await findPersonByEmail(client, email)).personId, "p-a");
});
