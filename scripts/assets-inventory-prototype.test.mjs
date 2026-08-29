import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../app/admin/assets-inventory-prototype/", import.meta.url);
const page = readFileSync(new URL("page.jsx", root), "utf8");
const client = readFileSync(new URL("AssetsInventoryPrototype.jsx", root), "utf8");
const operations = readFileSync(new URL("../app/admin/operations-prototype/OperationsPrototype.jsx", import.meta.url), "utf8");
const students = readFileSync(new URL("../app/admin/current-students-prototype/CurrentStudentsPrototype.jsx", import.meta.url), "utf8");
const bundle = [page, client].join("\n");

test("the assets prototype stays synthetic, read-only, and unindexed", () => {
  assert.match(page, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  assert.match(client, /Prototype · Synthetic data/);
  assert.match(client, /Nothing will be saved from this prototype/);
  assert.doesNotMatch(bundle, /\bfetch\s*\(|supabase/i);
});

test("the workspace covers all approved inventory areas", () => {
  for (const label of ["Instruments", "Tuners", "Lockers & locks", "Uniforms", "Music"]) assert.match(client, new RegExp(label.replace("&", "\\&")));
  assert.match(client, /Needs attention/);
  assert.match(client, /Current holder/);
  assert.match(client, /Asset name · A-Z/);
});

test("assets separate current assignment, actions, and history", () => {
  assert.match(client, /Current assignment/);
  assert.match(client, /Transfer/);
  assert.match(client, /Return/);
  assert.match(client, /Send to repair/);
  assert.match(client, /Mark missing/);
  assert.match(client, /History/);
});

test("student and command-center routes reach the full inventory workspace", () => {
  assert.match(students, /\/admin\/assets-inventory-prototype\?student=/);
  assert.match(operations, /\/admin\/assets-inventory-prototype/);
  assert.match(page, /initialStudentId/);
  assert.match(client, /Student context/);
  assert.match(client, /Open full student/);
});

test("every synthetic student asset has a matching inventory record", () => {
  const studentAssets = [...students.matchAll(/assets:\s*(\[[^\]]*\])/g)]
    .flatMap((match) => JSON.parse(match[1]));
  const inventoryNames = [...client.matchAll(/\bname:\s*"([^"]+)"/g)]
    .map((match) => match[1]);
  for (const asset of studentAssets) {
    assert.ok(inventoryNames.some((name) => name === asset || name.startsWith(asset + " ")), `Missing inventory record for ${asset}`);
  }
});
