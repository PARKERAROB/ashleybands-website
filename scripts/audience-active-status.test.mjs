import assert from "node:assert/strict";
import test from "node:test";

import { allStudentIds, resolveStudentIds } from "../lib/audience.js";

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
