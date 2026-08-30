import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../app/admin/attendance-workspace-prototype/", import.meta.url);
const page = readFileSync(new URL("page.jsx", root), "utf8");
const client = readFileSync(new URL("AttendanceWorkspacePrototype.jsx", root), "utf8");
const operations = readFileSync(new URL("../app/admin/operations-prototype/OperationsPrototype.jsx", import.meta.url), "utf8");
const students = readFileSync(new URL("../app/admin/current-students-prototype/CurrentStudentsPrototype.jsx", import.meta.url), "utf8");
const bundle = [page, client].join("\n");

test("the attendance workspace stays synthetic, read-only, and unindexed", () => {
  assert.match(page, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  assert.match(client, /Prototype · Synthetic data/);
  assert.match(client, /Read-only prototype/);
  assert.doesNotMatch(bundle, /\bfetch\s*\(|supabase/i);
});

test("program events and school day remain distinct attendance sources", () => {
  assert.match(client, /Program Events/);
  assert.match(client, /AshleyBands record/);
  assert.match(client, /School Day/);
  assert.match(client, /Infinite Campus official/);
  assert.match(client, /Their totals never merge/);
  assert.doesNotMatch(client, /Overall attendance/);
});

test("the program view includes event work and student patterns", () => {
  for (const label of ["Concert", "Rehearsal", "Football", "Other event", "Needs attendance", "Student concerns"]) assert.match(client, new RegExp(label));
  assert.match(client, /Open live attendance tool/);
});

test("the school-day view tracks official reports without becoming their source", () => {
  assert.match(client, /Infinite Campus tracking copy/);
  assert.match(client, /Reported in Infinite Campus/);
  assert.match(client, /Infinite Campus remains official/);
  assert.match(client, /Daily reports/);
  assert.match(client, /Absences/);
  assert.match(client, /Tardies/);
});

test("command-center and student routes open the connected workspace", () => {
  assert.match(operations, /attendance-workspace-prototype/);
  assert.match(students, /attendance-workspace-prototype\?student=/);
  assert.match(page, /initialStudentId/);
  assert.match(client, /Both attendance sources remain separate/);
});
