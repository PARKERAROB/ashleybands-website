import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../app/admin/ensembles-memberships-prototype/", import.meta.url);
const page = readFileSync(new URL("page.jsx", root), "utf8");
const client = readFileSync(new URL("EnsemblesMembershipsPrototype.jsx", root), "utf8");
const operations = readFileSync(new URL("../app/admin/operations-prototype/OperationsPrototype.jsx", import.meta.url), "utf8");
const students = readFileSync(new URL("../app/admin/current-students-prototype/CurrentStudentsPrototype.jsx", import.meta.url), "utf8");
const bundle = [page, client].join("\n");

test("the memberships workspace stays synthetic, read-only, and unindexed", () => {
  assert.match(page, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  assert.match(client, /Prototype · Synthetic data/);
  assert.match(client, /Read-only prototype/);
  assert.doesNotMatch(bundle, /\bfetch\s*\(|supabase/i);
});

test("program membership and school enrollment remain separate records", () => {
  assert.match(client, /Program memberships/);
  assert.match(client, /School class enrollment/);
  assert.match(client, /AshleyBands staff/);
  assert.match(client, /Infinite Campus/);
  assert.match(client, /Class enrollment does not automatically change AshleyBands program membership/);
});

test("the workspace supports combined operational rosters", () => {
  assert.match(client, /Wind \+ percussion \+ trip/);
  for (const label of ["Ensemble", "Activity or trip", "School class", "Grade", "Instrument", "Sort"]) assert.match(client, new RegExp(label));
  assert.match(client, /Copy students \+ guardians/);
});

test("groups, class sections, students, and attention items connect both directions", () => {
  for (const label of ["Groups", "Build a roster", "Class sections", "Needs attention", "Open group", "Open class", "Open memberships"]) assert.match(client, new RegExp(label));
  assert.match(client, /attendance-workspace-prototype\?student=/);
  assert.match(client, /assets-inventory-prototype\?student=/);
  assert.match(page, /initialStudentId/);
});

test("command center and current student profile link directly to memberships", () => {
  assert.match(operations, /ensembles-memberships-prototype/);
  assert.match(students, /ensembles-memberships-prototype\?student=/);
});
