import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const operationsRoot = new URL("../app/admin/operations-prototype/", import.meta.url);
const studentsRoot = new URL("../app/admin/current-students-prototype/", import.meta.url);
const page = readFileSync(new URL("page.jsx", operationsRoot), "utf8");
const client = readFileSync(new URL("OperationsPrototype.jsx", operationsRoot), "utf8");
const studentPage = readFileSync(new URL("page.jsx", studentsRoot), "utf8");
const studentClient = readFileSync(new URL("CurrentStudentsPrototype.jsx", studentsRoot), "utf8");
const bundle = [page, client, studentPage, studentClient].join("\n");

test("the command center stays synthetic, read-only, and unindexed", () => {
  assert.match(page, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  assert.match(client, /Prototype · Synthetic data/);
  assert.match(client, /Read-only prototype/);
  assert.doesNotMatch(bundle, /\bfetch\s*\(|supabase/i);
});

test("the landing page exposes each major operational starting point", () => {
  for (const label of ["Students", "Attendance", "Funding & money", "Forms", "Assets & inventory", "Ensembles", "Calendar & events", "Communication"]) {
    assert.match(client, new RegExp(label.replace(/[&]/g, "\\&")));
  }
  assert.match(client, /What do you need to work on\?/);
  assert.match(client, /Two valid directions/);
});

test("domain-first questions match Rob's examples", () => {
  assert.match(client, /Raised under \$100/);
  assert.match(client, /T-shirt unpaid/);
  assert.match(client, /Trumpets/);
  assert.match(client, /Show all trumpets/);
});

test("student context moves into domains and back to the full student", () => {
  assert.match(page, /initialStudentId/);
  assert.match(studentPage, /initialStudentId/);
  assert.match(studentClient, /area=attendance&student=/);
  assert.match(studentClient, /area=funding&student=/);
  assert.match(studentClient, /area=forms&student=/);
  assert.match(studentClient, /area=inventory&student=/);
  assert.match(client, /Student context retained/);
  assert.match(client, /Open full student/);
  assert.match(client, /Move across the connected record/);
});
