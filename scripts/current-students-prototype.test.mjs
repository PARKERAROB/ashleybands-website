import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../app/admin/current-students-prototype/", import.meta.url);
const page = readFileSync(new URL("page.jsx", root), "utf8");
const client = readFileSync(new URL("CurrentStudentsPrototype.jsx", root), "utf8");
const bundle = `${page}\n${client}`;

test("the staff roster prototype is synthetic, read-only, and excluded from indexing", () => {
  assert.match(page, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  assert.match(client, /Prototype · Synthetic data/);
  assert.match(client, /Nothing is saved or sent/);
  assert.doesNotMatch(bundle, /\bfetch\s*\(|supabase/i);
});

test("current students are the default and inactive students require an intentional view", () => {
  assert.match(client, /useState\("active"\)/);
  assert.match(client, /student\.status === view/);
  assert.match(client, /Inactive Students/);
  assert.match(client, /Current Students/);
});

test("the prototype separates roster placement from student music background", () => {
  assert.match(client, /programInstrument/);
  assert.match(client, /primaryInstrument/);
  assert.match(client, /Program instrument/);
  assert.match(client, /Music background/);
});

test("pronouns appear in student detail rather than the roster columns", () => {
  assert.match(client, /Pronouns · \{student\.pronouns\}/);
  assert.doesNotMatch(client, /<th>Pronouns<\/th>/);
  assert.match(client, /focusedId\s*\?/);
});

test("the roster supports combined operational filtering and list actions", () => {
  assert.match(client, /Filters combine/);
  assert.match(client, /Program instrument/);
  assert.match(client, /Open need/);
  assert.match(client, /Guardian emails/);
  assert.match(client, /Export/);
});
