import assert from "node:assert/strict";
import test from "node:test";
import {
  buildActiveStudentIndex,
  buildImportPlan,
  buildTransactionalApplyPayload,
  hashSources,
  parseMode,
  planOpenAssignments,
  resolveHolderClaims,
} from "./sync-assets.mjs";

test("check is the default and apply must be explicit", () => {
  assert.equal(parseMode([]), "check");
  assert.equal(parseMode(["--check"]), "check");
  assert.equal(parseMode(["--apply"]), "apply");
  assert.throws(() => parseMode(["--check", "--apply"]), /either --check or --apply/);
});

test("source hashing is stable across caller order and changes with file content", () => {
  const first = hashSources([{ name: "b.csv", contents: "two" }, { name: "a.csv", contents: "one" }]);
  const reordered = hashSources([{ name: "a.csv", contents: "one" }, { name: "b.csv", contents: "two" }]);
  const changed = hashSources([{ name: "a.csv", contents: "changed" }, { name: "b.csv", contents: "two" }]);
  assert.equal(first, reordered);
  assert.notEqual(first, changed);
});

test("lock combinations appear only in the lock-secret plan", () => {
  const plan = buildImportPlan({
    lockRows: [{ serial: "SERIAL-1", combination: "12-34-56", assigned_student: "", confidence: "high", inventoried: "yes", notes: "" }],
    lockerRows: [{ "Locker Prefix": "A", "Locker #": "10", "Lock Serial #": "SERIAL-1", Combination: "12-34-56", "Student Assigned": "", "Student Assigned 2": "" }],
  });
  assert.equal(plan.lockSecrets[0].combination, "12-34-56");
  const nonsecret = JSON.stringify({
    assets: plan.assets,
    instrumentExtensions: plan.instrumentExtensions,
    lockExtensions: plan.lockExtensions,
    holderClaims: plan.holderClaims,
    issues: plan.issues,
  });
  assert.doesNotMatch(nonsecret, /12-34-56/);
});

test("apply payload keeps source identities and secrets inside one transactional RPC plan", () => {
  const plan = buildImportPlan({
    instrumentRows: [{
      asset_id: "INST-1", instrument_type: "Trumpet", serial_number: "SERIAL-1",
      assigned_student: "North, Avery",
    }],
    lockRows: [{
      serial: "LOCK-1", combination: "12-34-56", assigned_student: "",
      confidence: "high", inventoried: "yes", notes: "",
    }],
  });
  const payload = buildTransactionalApplyPayload({
    runId: "run-1",
    plan,
    resolvedAssignments: [{
      sourceSystem: "bandsofahs_instrument_inventory_csv",
      sourceKey: "INST-1",
      studentId: "student-1",
    }],
    issues: [{ sourceKey: "review-1", issueType: "review", summary: "Review", candidates: [] }],
  });

  assert.equal(payload.p_run_id, "run-1");
  assert.equal(payload.p_instruments[0].source_key, "INST-1");
  assert.deepEqual(payload.p_assignments[0], {
    source_system: "bandsofahs_instrument_inventory_csv",
    source_key: "INST-1",
    student_id: "student-1",
  });
  assert.equal(payload.p_lock_secrets[0].combination, "12-34-56");
  const nonsecretPayload = { ...payload, p_lock_secrets: [] };
  assert.doesNotMatch(JSON.stringify(nonsecretPayload), /12-34-56/);
});

test("only exact unique active-student matches become assignment candidates", () => {
  const students = [
    { id: "active-1", status: "active", source_student_id: "source-1", legal_first: "Avery", legal_last: "North", preferred_first: "Avery", display_name: "Avery North" },
    { id: "inactive-1", status: "inactive", source_student_id: "source-2", legal_first: "Past", legal_last: "Student", display_name: "Past Student" },
    { id: "duplicate-1", status: "active", source_student_id: "source-3", legal_first: "Same", legal_last: "Name", display_name: "Same Name" },
    { id: "duplicate-2", status: "active", source_student_id: "source-4", legal_first: "Same", legal_last: "Name", display_name: "Same Name" },
  ];
  const result = resolveHolderClaims([
    { sourceSystem: "source", sourceKey: "exact", holders: ["North, Avery"] },
    { sourceSystem: "source", sourceKey: "inactive", holders: ["Past Student"] },
    { sourceSystem: "source", sourceKey: "ambiguous", holders: ["Same Name"] },
    { sourceSystem: "source", sourceKey: "fuzzy", holders: ["Avery N."] },
  ], students);
  assert.deepEqual(result.assignments, [{ sourceSystem: "source", sourceKey: "exact", studentId: "active-1" }]);
  assert.deepEqual(result.issues.map((item) => item.issueType).sort(), ["ambiguous_student", "unmatched_student", "unmatched_student"]);
  assert.equal(buildActiveStudentIndex(students).has("past student"), false);
});

test("shared source holders become a review issue instead of two open assignments", () => {
  const result = resolveHolderClaims([
    { sourceSystem: "tuners", sourceKey: "1", holders: ["First Student", "Second Student"] },
  ], [
    { id: "one", status: "active", display_name: "First Student" },
    { id: "two", status: "active", display_name: "Second Student" },
  ]);
  assert.equal(result.assignments.length, 0);
  assert.equal(result.issues[0].issueType, "multiple_source_holders");
});

test("assignment planning never closes, dates, or replaces an open assignment", () => {
  const identities = new Map([["source\0asset-1", "asset-id"]]);
  const conflict = planOpenAssignments(
    [{ sourceSystem: "source", sourceKey: "asset-1", studentId: "new-student" }],
    identities,
    [{ id: "existing", asset_id: "asset-id", student_id: "old-student", assignment_status: "current" }],
  );
  assert.equal(conflict.inserts.length, 0);
  assert.equal(conflict.issues[0].issueType, "current_assignment_conflict");

  const fresh = planOpenAssignments(
    [{ sourceSystem: "source", sourceKey: "asset-1", studentId: "new-student" }],
    identities,
    [],
  );
  assert.deepEqual(fresh.inserts[0], {
    asset_id: "asset-id",
    student_id: "new-student",
    program_group_id: null,
    holder_label: "",
    starts_at: null,
    ends_at: null,
    assignment_status: "provisional",
    source_system: "source",
    source_ref: "asset-1",
    notes: "",
  });
});

test("duplicate and missing source identities are issues, never fabricated assets", () => {
  const plan = buildImportPlan({
    instrumentRows: [
      { asset_id: "INST-1", instrument_type: "Trumpet" },
      { asset_id: "INST-1", instrument_type: "Trumpet" },
      { asset_id: "", instrument_type: "Clarinet" },
    ],
  });
  assert.equal(plan.assets.length, 0);
  assert.deepEqual(plan.issues.map((item) => item.issueType).sort(), ["duplicate_source_key", "missing_source_key"]);
});
