import assert from "node:assert/strict";
import test from "node:test";

import { allStudentIds, resolveStudentIds } from "../lib/audience.js";
import {
  createAudienceConfirmation,
  enforcedBroadcastAudience,
  verifyAudienceConfirmation,
} from "../lib/broadcastAudienceConfirmation.js";

class Query {
  constructor(table, calls) {
    this.table = table;
    this.calls = calls;
    this.filters = [];
  }

  select(columns) {
    this.calls.push([this.table, "select", columns]);
    return this;
  }

  eq(field, value) {
    this.calls.push([this.table, "eq", field, value]);
    this.filters.push(["eq", field, value]);
    return this;
  }

  in(field, values) {
    this.calls.push([this.table, "in", field, values]);
    this.filters.push(["in", field, values]);
    return this;
  }

  is(field, value) {
    this.calls.push([this.table, "is", field, value]);
    this.filters.push(["is", field, value]);
    return this;
  }

  result() {
    if (this.table === "portal_students") {
      assert.ok(
        this.filters.some(([op, field, value]) => op === "eq" && field === "status" && value === "active"),
        "every roster query must require active status"
      );
      return { data: [{ id: "active-1" }, { id: "active-2" }] };
    }
    if (this.table === "portal_student_attributes") {
      return { data: [{ student_id: "active-1" }, { student_id: "inactive-9" }] };
    }
    if (this.table === "program_memberships") {
      assert.ok(this.filters.some(([op, field, value]) => op === "is" && field === "ends_on" && value === null));
      return { data: [{ student_id: "active-2" }, { student_id: "inactive-9" }] };
    }
    throw new Error(`Unexpected table ${this.table}`);
  }

  then(resolve, reject) {
    return Promise.resolve(this.result()).then(resolve, reject);
  }
}

function fakeClient() {
  const calls = [];
  return {
    calls,
    from(table) {
      return new Query(table, calls);
    }
  };
}

test("the everyone audience contains active students only", async () => {
  const client = fakeClient();
  assert.deepEqual(await allStudentIds(client), ["active-1", "active-2"]);
});

test("historical attribute rows cannot restore an inactive student", async () => {
  const client = fakeClient();
  const ids = await resolveStudentIds({
    match: "all",
    predicates: [{ key: "ensemble", op: "in", values: ["Concert Band"] }]
  }, client);
  assert.deepEqual(ids, ["active-1"]);
});

test("normalized current program memberships resolve broadcast audiences", async () => {
  const client = fakeClient();
  const ids = await resolveStudentIds({
    match: "all",
    predicates: [{ key: "program_group", op: "in", values: ["wind-ensemble-2026-27"] }]
  }, client);
  assert.deepEqual(ids, ["active-2"]);
});

test("a direct student audience is still intersected with current status", async () => {
  const client = fakeClient();
  const ids = await resolveStudentIds({
    match: "all",
    predicates: [{ key: "student_id", op: "in", values: ["active-1", "inactive-9"] }]
  }, client);
  assert.deepEqual(ids, ["active-1"]);
});

test("direct-student broadcast mode cannot be expanded by client filters or axis", () => {
  const enforced = enforcedBroadcastAudience({
    directStudentId: "student-1",
    recipientAxis: "guardians",
    audienceFilter: {},
  });
  assert.equal(enforced.recipientAxis, "both");
  assert.deepEqual(enforced.audienceFilter, {
    match: "all",
    predicates: [{ key: "student_id", op: "in", values: ["student-1"] }],
  });
});

test("broadcast confirmation binds staff, audience, count, and recipient identities", () => {
  process.env.PORTAL_SESSION_SECRET = "broadcast-test-secret-that-is-long-enough";
  const recipients = [{ student_id: "student-1", person_id: "person-1", email: "Family@Example.com" }];
  const audienceFilter = { predicates: [{ values: ["student-1"], op: "in", key: "student_id" }], match: "all" };
  const token = createAudienceConfirmation({ staffId: "staff-1", audienceFilter, recipientAxis: "both", recipients });
  assert.equal(verifyAudienceConfirmation(token, {
    staffId: "staff-1",
    audienceFilter: { match: "all", predicates: [{ key: "student_id", op: "in", values: ["student-1"] }] },
    recipientAxis: "both",
    recipients,
  }), true, "equivalent filter objects should verify regardless of key order");
  assert.equal(verifyAudienceConfirmation(token, {
    staffId: "staff-1",
    audienceFilter,
    recipientAxis: "both",
    recipients: [...recipients, { student_id: "student-2", person_id: "person-2", email: "other@example.com" }],
  }), false);
  assert.equal(verifyAudienceConfirmation(token, {
    staffId: "staff-2", audienceFilter, recipientAxis: "both", recipients,
  }), false);
});
